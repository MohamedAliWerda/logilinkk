import { HttpException, HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { getSupabase } from '../config/supabase.client';

type StudentRecommendationItem = {
  title?: string;
  source?: string;
  duration_hours?: number | null;
  description?: string;
};

type StudentRecommendationDocument = {
  _id: string;
  id_etudiant: number;
  rec: StudentRecommendationItem[];
};

type ScoreV2Document = {
  id: string;
  'score emp v2': number;
  updated_at: string;
};

type ScoreV2PythonResult = {
  score_final: number;
  total_delta: number;
  score_base: number;
  certification_count: number;
};

@Injectable()
export class ScoreV2Service implements OnModuleDestroy {
  private readonly logger = new Logger(ScoreV2Service.name);
  private readonly supabase = getSupabase();
  private readonly mongoUri: string;
  private readonly mongoDbName: string;
  private readonly sourceCollectionName: string;
  private readonly scoreCollectionName: string;
  private readonly pythonExecutable: string;
  private readonly pythonScriptPath: string;
  private readonly pythonTimeoutMs: number;

  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;

  constructor(private readonly configService: ConfigService) {
    this.mongoUri = this.configService.get<string>('MONGO_URI') ?? '';
    this.mongoDbName = this.configService.get<string>('RECOMMENDATIONS_MONGO_DB') ?? 'recmond';
    this.sourceCollectionName = this.configService.get<string>('RECOMMENDATIONS_MONGO_COLLECTION') ?? 'student_recommendations';
    this.scoreCollectionName = this.configService.get<string>('SCORE_V2_MONGO_COLLECTION') ?? 'score v2';

    const configuredPython = this.configService.get<string>('SCORE_V2_PYTHON_EXECUTABLE')
      ?? this.configService.get<string>('EMPLOYABILITY_PYTHON_EXECUTABLE')
      ?? this.configService.get<string>('PYTHON_EXECUTABLE')
      ?? '';
    this.pythonExecutable = this.resolvePythonExecutable(configuredPython);

    const repoRootGuess = resolve(process.cwd(), '..');
    this.pythonScriptPath = this.configService.get<string>('SCORE_V2_RUNNER_SCRIPT_PATH')
      ?? resolve(repoRootGuess, 'score-emp-v2-service', 'run_score_v2.py');

    const configuredTimeoutMs = Number(this.configService.get<string>('SCORE_V2_TIMEOUT_MS') ?? '180000');
    this.pythonTimeoutMs = Number.isFinite(configuredTimeoutMs)
      ? Math.max(10_000, Math.floor(configuredTimeoutMs))
      : 180_000;
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.mongoClient) return;
    await this.mongoClient.close();
    this.mongoClient = null;
    this.db = null;
  }

  async getScoreForAuthId(authId: string): Promise<{ id: string; scoreEmpV2: number } | null> {
    const userId = await this.resolveCurrentUserId(authId);
    if (!userId) return null;

    const collection = await this.getScoreCollection();
    const existing = await collection.findOne({ id: userId });
    if (!existing) return null;

    if ('score ats v2' in (existing as Record<string, unknown>)) {
      await collection.updateOne({ id: userId }, { $unset: { 'score ats v2': '' } });
    }

    return {
      id: String(existing.id),
      scoreEmpV2: this.clampScore(existing['score emp v2']),
    };
  }

  async computeAndStoreForAuthId(authId: string): Promise<{ id: string; scoreEmpV2: number }> {
    this.logger.log(`[flow] score-v2 compute requested for auth_id=${authId}`);

    const userId = await this.resolveCurrentUserId(authId);
    if (!userId) {
      throw new HttpException('Compte utilisateur introuvable.', HttpStatus.NOT_FOUND);
    }
    this.logger.log(`[flow] resolved Supabase user.id=${userId}`);

    const studentRecommendations = await this.getStudentRecommendations(userId);
    if (!studentRecommendations.length) {
      throw new HttpException(
        'Aucune recommandation trouvée pour cet étudiant.',
        HttpStatus.NOT_FOUND,
      );
    }
    this.logger.log(`[flow] loaded ${studentRecommendations.length} recommendation item(s) from Mongo source collection`);

    const scoreBase = await this.getScoreBaseForStudent(userId);
    this.logger.log(`[flow] loaded score_base=${scoreBase}`);

    this.logger.log('[flow] launching Python score-v2 pipeline');
    const scorePython = await this.runScoreV2Python(studentRecommendations, scoreBase);
    const scoreEmpV2 = this.clampScore(scorePython.score_final);
    this.logger.log(
      `[flow] python completed: score_final=${scoreEmpV2} total_delta=${scorePython.total_delta} certs=${scorePython.certification_count}`,
    );

    const payload: ScoreV2Document = {
      id: userId,
      'score emp v2': scoreEmpV2,
      updated_at: new Date().toISOString(),
    };

    const collection = await this.getScoreCollection();
    await collection.updateOne(
      { id: userId },
      {
        $set: payload,
        $unset: { 'score ats v2': '' },
      },
      { upsert: true },
    );
    this.logger.log(`[flow] saved document in Mongo collection '${this.scoreCollectionName}' for id=${userId}`);

    return {
      id: userId,
      scoreEmpV2,
    };
  }

  private resolvePythonExecutable(configuredExecutable: string): string {
    const normalized = String(configuredExecutable ?? '').trim();
    if (normalized) return normalized;

    if (process.platform === 'win32') {
      return 'py';
    }

    return 'python3';
  }

  private async getDatabase(): Promise<Db> {
    if (this.db) return this.db;

    if (!this.mongoUri) {
      throw new HttpException('MONGO_URI is not configured.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.mongoClient = new MongoClient(this.mongoUri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(this.mongoDbName);
    this.logger.log(`Connected to MongoDB database: ${this.mongoDbName}`);
    return this.db;
  }

  private async getSourceCollection() {
    const db = await this.getDatabase();
    return db.collection<StudentRecommendationDocument>(this.sourceCollectionName);
  }

  private async getScoreCollection() {
    const db = await this.getDatabase();
    return db.collection<ScoreV2Document>(this.scoreCollectionName);
  }

  private async resolveCurrentUserId(authId: string): Promise<string | null> {
    const normalizedAuthId = String(authId ?? '').trim();
    if (!normalizedAuthId) return null;

    const { data, error } = await this.supabase
      .from('user')
      .select('id')
      .eq('auth_id', normalizedAuthId)
      .maybeSingle();

    if (error) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const rawId = data?.id;
    if (rawId === undefined || rawId === null) return null;
    const normalizedId = String(rawId).trim();
    return normalizedId || null;
  }

  private async getStudentRecommendations(userId: string): Promise<StudentRecommendationItem[]> {
    const idAsNumber = Number(userId);
    if (!Number.isFinite(idAsNumber)) {
      throw new HttpException('ID étudiant invalide pour la recherche Mongo.', HttpStatus.BAD_REQUEST);
    }

    const collection = await this.getSourceCollection();
    const doc = await collection.findOne({ id_etudiant: Math.trunc(idAsNumber) });
    if (!doc || !Array.isArray(doc.rec)) {
      return [];
    }

    return doc.rec.filter((item) => typeof item === 'object' && item !== null);
  }

  private async getScoreBaseForStudent(userId: string): Promise<number> {
    const tableCandidates = ['score_employabilité', 'score_employabilite'];
    const columnCandidates = ['etudiant', 'id_etudiant', 'cin_passport'];

    for (const tableName of tableCandidates) {
      for (const columnName of columnCandidates) {
        const { data, error } = await this.supabase
          .from(tableName)
          .select('score_final')
          .eq(columnName, userId)
          .maybeSingle();

        if (error) {
          const message = String(error.message ?? '').toLowerCase();
          const isSchemaMismatch = message.includes('column') || message.includes('does not exist') || message.includes('relation');
          if (isSchemaMismatch) {
            continue;
          }
          throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
        }

        const score = Number(data?.score_final);
        if (Number.isFinite(score)) {
          return this.clampScore(score);
        }
      }
    }

    return 55;
  }

  private runScoreV2Python(
    certifications: StudentRecommendationItem[],
    scoreBase: number,
  ): Promise<ScoreV2PythonResult> {
    if (!existsSync(this.pythonScriptPath)) {
      throw new HttpException(
        `Score V2 runner script not found at ${this.pythonScriptPath}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return new Promise<ScoreV2PythonResult>((resolvePromise, rejectPromise) => {
      const inputPayload = JSON.stringify({
        score_base: scoreBase,
        certifications,
      });

      const args = ['-u', this.pythonScriptPath, '--input-json', inputPayload];
      this.logger.log(
        `[flow] spawn python command: ${this.pythonExecutable} -u ${this.pythonScriptPath} --input-json <payload>`
      );
      const child = spawn(this.pythonExecutable, args, {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
        },
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';
      let stderrBuffer = '';

      const timeout = setTimeout(() => {
        child.kill();
        rejectPromise(
          new HttpException(
            `Score V2 Python process timed out after ${this.pythonTimeoutMs}ms`,
            HttpStatus.GATEWAY_TIMEOUT,
          ),
        );
      }, this.pythonTimeoutMs);

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        stderr += text;
        stderrBuffer += text;

        const lines = stderrBuffer.split(/\r?\n/);
        stderrBuffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            this.logger.log(`[python] ${trimmed}`);
          }
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        rejectPromise(
          new HttpException(
            `Score V2 Python process failed to start: ${err?.message ?? err}`,
            HttpStatus.BAD_GATEWAY,
          ),
        );
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        const tail = stderrBuffer.trim();
        if (tail) {
          this.logger.log(`[python] ${tail}`);
        }

        this.logger.log(`[flow] python process exit code=${code}`);

        if (code !== 0) {
          const details = stderr.trim() || stdout.trim() || `exit code ${code}`;
          rejectPromise(new HttpException(`Score V2 Python process failed: ${details}`, HttpStatus.BAD_GATEWAY));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as Record<string, any>;
          const scoreFinal = Number(parsed?.score_final);
          const totalDelta = Number(parsed?.total_delta ?? 0);
          const inputScoreBase = Number(parsed?.score_base ?? scoreBase);
          const certificationCount = Number(parsed?.certification_count ?? certifications.length);

          if (!Number.isFinite(scoreFinal)) {
            rejectPromise(new HttpException('Invalid Score V2 result from Python.', HttpStatus.BAD_GATEWAY));
            return;
          }

          resolvePromise({
            score_final: scoreFinal,
            total_delta: Number.isFinite(totalDelta) ? totalDelta : 0,
            score_base: Number.isFinite(inputScoreBase) ? inputScoreBase : scoreBase,
            certification_count: Number.isFinite(certificationCount) ? certificationCount : certifications.length,
          });
        } catch {
          rejectPromise(
            new HttpException(
              `Unable to parse Score V2 Python output as JSON: ${stdout.trim() || '(empty output)'}`,
              HttpStatus.BAD_GATEWAY,
            ),
          );
        }
      });
    });
  }

  private clampScore(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Number(n.toFixed(2))));
  }
}