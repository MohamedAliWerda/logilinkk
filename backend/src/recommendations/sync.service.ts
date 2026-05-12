import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Db, MongoClient } from 'mongodb';
import { getSupabase } from '../config/supabase.client';

type StudentRecommendationItem = {
  title: string;
  source: string;
  duration_hours: number | null;
  description: string;
};

type StudentRecommendationDocument = {
  _id: string;
  id_etudiant: number;
  rec: StudentRecommendationItem[];
  last_synced_at: string;
};

@Injectable()
export class RecommendationsSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RecommendationsSyncService.name);
  private readonly supabase = getSupabase();
  private readonly uri: string;
  private readonly dbName = 'recmond';
  private readonly autoSyncEnabled: boolean;
  private readonly autoSyncIntervalMs: number;

  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private lastTargetsFingerprint: string | null = null;
  private syncInProgress = false;

  constructor(private readonly configService: ConfigService) {
    this.uri = this.configService.get<string>('MONGO_URI') ?? '';

    const autoSyncRaw = String(
      this.configService.get<string>('RECOMMENDATIONS_MONGO_AUTO_SYNC') ?? 'true',
    )
      .trim()
      .toLowerCase();
    this.autoSyncEnabled = autoSyncRaw !== 'false' && autoSyncRaw !== '0' && autoSyncRaw !== 'no';

    const intervalRaw = Number(
      this.configService.get<string>('RECOMMENDATIONS_MONGO_AUTO_SYNC_INTERVAL_MS') ?? '15000',
    );
    this.autoSyncIntervalMs = Number.isFinite(intervalRaw)
      ? Math.max(5_000, Math.trunc(intervalRaw))
      : 15_000;
  }

  async onModuleInit(): Promise<void> {
    if (!this.autoSyncEnabled) {
      this.logger.log('Mongo recommendations auto-sync is disabled by env config.');
      return;
    }

    // Ensure we start from a consistent state without manual intervention.
    await this.syncIfTargetsChanged(true);

    this.pollTimer = setInterval(() => {
      void this.syncIfTargetsChanged(false);
    }, this.autoSyncIntervalMs);

    this.logger.log(
      `Mongo recommendations auto-sync watcher started (interval=${this.autoSyncIntervalMs}ms).`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    await this.close();
  }

  private buildTargetsFingerprint(rows: Array<{ auth_id?: unknown; recommendation_id?: unknown }>): string {
    if (!rows.length) return 'empty';

    const normalized = rows
      .map((row) => {
        const authId = String(row?.auth_id ?? '').trim();
        const recommendationId = String(row?.recommendation_id ?? '').trim();
        return `${authId}|${recommendationId}`;
      })
      .filter((entry) => entry !== '|')
      .sort();

    return normalized.join('||');
  }

  private async getTargetsFingerprint(): Promise<string> {
    const { data, error } = await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .select('auth_id,recommendation_id');

    if (error) {
      throw new Error(
        `ai_confirmed_recommendation_targets fingerprint fetch failed: ${error.message}`,
      );
    }

    return this.buildTargetsFingerprint((data ?? []) as Array<{ auth_id?: unknown; recommendation_id?: unknown }>);
  }

  private async syncIfTargetsChanged(forceRun: boolean): Promise<void> {
    if (this.syncInProgress) {
      return;
    }

    this.syncInProgress = true;
    try {
      const nextFingerprint = await this.getTargetsFingerprint();
      const hasChanged = this.lastTargetsFingerprint !== nextFingerprint;

      if (!forceRun && !hasChanged) {
        return;
      }

      const reason = forceRun ? 'startup' : 'target-table-change';
      this.logger.log(`Running automatic Mongo sync (${reason})...`);
      await this.fullSyncAllStudents();
      this.lastTargetsFingerprint = nextFingerprint;
    } catch (err: any) {
      this.logger.error(`Automatic Mongo sync failed: ${err?.message ?? err}`);
    } finally {
      this.syncInProgress = false;
    }
  }

  private normalizeText(value: string): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private isMetierMatch(metier: string, professionalTitle: string): boolean {
    const m = this.normalizeText(String(metier ?? ''));
    const t = this.normalizeText(String(professionalTitle ?? ''));
    if (!m || !t) return false;
    if (m === t) return true;
    if (m.includes(t) || t.includes(m)) return true;
    const mTokens = m.split(' ').filter(Boolean);
    const tTokens = new Set(t.split(' ').filter(Boolean));
    const common = mTokens.filter((token) => tTokens.has(token)).length;
    return common >= 2;
  }

  private parseDurationHours(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    const s = String(value).trim().toLowerCase();
    if (!s) return null;

    const numMatch = s.match(/([0-9]+(?:[\.,][0-9]+)?)/);
    const num = numMatch ? Number(numMatch[1].replace(',', '.')) : NaN;
    if (!Number.isFinite(num)) return null;

    if (/h$|heure|heures/.test(s)) return Math.round(num * 100) / 100;
    if (/min|mn/.test(s)) return Math.round((num / 60) * 100) / 100;
    if (/jour|jours|\bj\b/.test(s)) return Math.round((num * 8) * 100) / 100;
    if (/semaine|semaines|sem\b/.test(s)) return Math.round((num * 40) * 100) / 100;
    if (/mois/.test(s)) return Math.round((num * 160) * 100) / 100;
    if (/an|ans/.test(s)) return Math.round((num * 1920) * 100) / 100;

    // fallback to integer hours
    const intval = Math.trunc(num);
    return Number.isFinite(intval) ? intval : null;
  }

  private async getDatabase(): Promise<Db> {
    if (this.db) return this.db;
    if (!this.uri) throw new Error('MONGO_URI is not configured');

    this.mongoClient = new MongoClient(this.uri, {
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
    });
    await this.mongoClient.connect();
    this.db = this.mongoClient.db(this.dbName);
    this.logger.log(`Connected to MongoDB database: ${this.dbName}`);
    return this.db;
  }

  async fullSyncAllStudents(): Promise<{ inserted: number; updated: number; skipped: number }> {
    const result = { inserted: 0, updated: 0, skipped: 0 };
    const db = await this.getDatabase();
    const collection = db.collection<StudentRecommendationDocument>(
      'student_recommendations',
    );

    const { data: students, error: studentsError } = await this.supabase
      .from('profils_etudiant')
      .select('id,cin_passport');
    if (studentsError) throw new Error(`profils_etudiant fetch failed: ${studentsError.message}`);
    if (!students || !students.length) return result;

    const cinValues = students
      .map((s: any) => String(s?.cin_passport ?? '').trim())
      .filter((cin: string) => !!cin);

    const authByCin = new Map<string, string>();
    if (cinValues.length) {
      const { data: users, error: usersError } = await this.supabase
        .from('user')
        .select('cin_passport,auth_id')
        .in('cin_passport', cinValues);
      if (usersError) throw new Error(`user fetch failed: ${usersError.message}`);

      for (const row of users ?? []) {
        const cin = String(row?.cin_passport ?? '').trim();
        const authId = String(row?.auth_id ?? '').trim();
        if (cin && authId) {
          authByCin.set(cin, authId);
        }
      }
    }

    const { data: targetRows, error: targetsError } = await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .select('recommendation_id,auth_id');
        const currentTargetsFingerprint = this.buildTargetsFingerprint(
          (targetRows ?? []) as Array<{ auth_id?: unknown; recommendation_id?: unknown }>,
        );

    if (targetsError) {
      throw new Error(
        `ai_confirmed_recommendation_targets fetch failed: ${targetsError.message}`,
      );
    }

    const recommendationIds = Array.from(
      new Set(
        (targetRows ?? [])
          .map((row: any) => String(row?.recommendation_id ?? '').trim())
          .filter((id: string) => !!id),
      ),
    );

    const recommendationIdsByAuth = new Map<string, Set<string>>();
    for (const row of targetRows ?? []) {
      const authId = String(row?.auth_id ?? '').trim();
      const recommendationId = String(row?.recommendation_id ?? '').trim();
      if (!authId || !recommendationId) continue;
      const current = recommendationIdsByAuth.get(authId) ?? new Set<string>();
      current.add(recommendationId);
      recommendationIdsByAuth.set(authId, current);
    }

    const confirmedByRecommendationId = new Map<string, any>();
    if (recommendationIds.length) {
      const { data: confirmedRows, error: confirmedError } = await this.supabase
        .from('ai_confirmed_recommendations')
        .select('*')
        .in('recommendation_id', recommendationIds)
        .order('confirmed_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false, nullsFirst: false });
      if (confirmedError) {
        throw new Error(`ai_confirmed_recommendations fetch failed: ${confirmedError.message}`);
      }

      for (const row of confirmedRows ?? []) {
        const recommendationId = String(row?.recommendation_id ?? '').trim();
        if (!recommendationId) continue;
        // Keep first row as latest because rows are ordered by date desc.
        if (!confirmedByRecommendationId.has(recommendationId)) {
          confirmedByRecommendationId.set(recommendationId, row);
        }
      }
    }

    for (const s of students) {
      const id_etudiant = Number(s?.id ?? NaN);
      const cin = String(s?.cin_passport ?? '').trim();
      if (!Number.isFinite(id_etudiant)) continue;

      const authId = cin ? authByCin.get(cin) ?? null : null;
      const linkedRecommendationIds = authId
        ? recommendationIdsByAuth.get(authId) ?? new Set<string>()
        : new Set<string>();

      // Source of truth: ai_confirmed_recommendation_targets links only.
      const recs: StudentRecommendationItem[] = [];
      for (const rid of linkedRecommendationIds) {
        const confirmed = confirmedByRecommendationId.get(rid);
        if (!confirmed) continue;

        const title = String(confirmed?.cert_title ?? 'N/A');
        const source = String(confirmed?.cert_provider ?? 'Non spécifié');
        const duration_hours = this.parseDurationHours(confirmed?.cert_duration ?? null);
        const description = String(confirmed?.cert_description ?? '').trim() ?? '';

        recs.push({ title, source, duration_hours, description });
      }

      // sort recs by title
      const sortedRecs = recs.slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));

      // compare with existing mongo doc
      const docId = `etudiant_${id_etudiant}`;
      const existing = await collection.findOne({ _id: docId });

      if (!sortedRecs.length) {
        if (existing) {
          await collection.deleteOne({ _id: docId });
          result.updated++;
        } else {
          result.skipped++;
        }
        continue;
      }

      const existingRecs = (existing?.rec ?? []) as StudentRecommendationItem[];
      const sortedExisting = existingRecs.slice().sort((a, b) => String(a.title).localeCompare(String(b.title)));

      const changed = JSON.stringify(sortedExisting) !== JSON.stringify(sortedRecs);
      if (!existing || changed) {
        const now = new Date().toISOString();
        await collection.updateOne(
          { _id: docId },
          {
            $set: {
              id_etudiant,
              rec: sortedRecs,
              last_synced_at: now,
            },
          },
          { upsert: true },
        );

        if (!existing) result.inserted++; else result.updated++;
      } else {
        result.skipped++;
      }
    }

    this.lastTargetsFingerprint = currentTargetsFingerprint;
    return result;
  }

  async close(): Promise<void> {
    if (!this.mongoClient) return;
    await this.mongoClient.close();
    this.mongoClient = null;
    this.db = null;
  }
}
