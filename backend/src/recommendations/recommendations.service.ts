import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { getSupabase } from '../config/supabase.client';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';
import { RecommendationStatus, UpdateRecommendationDto } from './dto/update-recommendation.dto';

type PythonRagHit = {
  score: number;
  source: string;
  titre: string;
  text: string;
};

type PythonRecommendationItem = {
  rank: number;
  competence: string;
  metier: string;
  domaine: string;
  competence_type: string;
  keywords: string;
  pct_gap: number;
  n_gap: number;
  cv_submission_id?: string | null;
  target_job_id?: string | null;
  priority: string;
  recommended_certification: string;
  recommendation_text: string;
  rag_results: PythonRagHit[];
};

type PythonRecommendationsResponse = {
  generated_at: string;
  qdrant_collection: string;
  total_students: number;
  total_unique_gaps: number;
  significant_gaps: number;
  recommendations: PythonRecommendationItem[];
};

type RecommendationRow = {
  id: string;
  rank_position: number;
  competence_name: string;
  metier_name: string;
  domaine_name: string;
  competence_type: string;
  keywords: string;
  pct_gap: number;
  n_gap: number;
  priority: string;
  recommended_certification: string;
  recommendation_text: string;
  rag_results: PythonRagHit[];
  status: RecommendationStatus;
  admin_note: string | null;
  source_collection: string;
  generated_at: string;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
};

type RawAiRecommendationRow = {
  id: string | number;
  cv_submission_id: string | null;
  target_job_id: string | null;
  detected_gap: string;
  recommended_certs: string | null;
  justification_llm: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type RawConfirmedRecommendationRow = {
  gap_title: string | null;
  level: string | null;
  metier: string | null;
  keywords: string | null;
  concern_rate: number | string | null;
  students_impacted: number | string | null;
  llm_recommendation: string | null;
  cert_title: string | null;
  updated_at: string | null;
};

type ParsedRecommendationSignals = {
  pctGap: number | null;
  nGap: number | null;
  totalStudents: number | null;
  metierName: string | null;
};

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly supabase = getSupabase();
  private readonly pythonServiceUrl: string;
  private readonly pythonServiceTimeoutMs: number;
  private readonly tableName: string;

  constructor(private readonly configService: ConfigService) {
    this.pythonServiceUrl = (
      this.configService.get<string>('RECOMMENDATION_PYTHON_SERVICE_URL')
      ?? 'http://127.0.0.1:8002'
    ).replace(/\/+$/, '');

    const configuredTimeout = Number(
      this.configService.get<string>('RECOMMENDATION_PYTHON_TIMEOUT_MS') ?? '120000',
    );
    this.pythonServiceTimeoutMs = Number.isFinite(configuredTimeout)
      ? Math.max(10_000, Math.floor(configuredTimeout))
      : 120_000;

    this.tableName = (
      this.configService.get<string>('RECOMMENDATIONS_TABLE')
      ?? this.configService.get<string>('AI_RECOMMENDATIONS_TABLE')
      ?? 'ai_recommendations'
    ).trim() || 'ai_recommendations';
  }

  private isTransientNetworkError(err: any): boolean {
    const text = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.code ?? ''}`.toLowerCase();
    return [
      'fetch failed',
      'etimedout',
      'connect timeout',
      'und_err_connect_timeout',
      'econnreset',
      'eai_again',
      'network',
    ].some((token) => text.includes(token));
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(operation: () => PromiseLike<T>, maxAttempts = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;
        if (!this.isTransientNetworkError(err) || attempt === maxAttempts) {
          throw err;
        }
        const waitMs = 350 * attempt;
        this.logger.warn(
          `Transient network error (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms...`,
        );
        await this.wait(waitMs);
      }
    }
    throw lastError;
  }

  private normalizeGapKeyPart(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .slice(0, 240);
  }

  private toNullableInt(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.trunc(parsed);
  }

  private toNullableText(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text.length > 0 ? text : null;
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
  }

  private normalizePercentFromText(value: string): number | null {
    const cleaned = value.replace(',', '.').trim();
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }

  private parseRecommendationSignals(textValue: string): ParsedRecommendationSignals {
    const text = String(textValue ?? '').trim();
    if (!text) {
      return {
        pctGap: null,
        nGap: null,
        totalStudents: null,
        metierName: null,
      };
    }

    const pctMatch = text.match(/constat\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*%/i);
    const countsMatch = text.match(/\((\d+)\s*\/\s*(\d+)\)/);
    const metierMatch = text.match(/pour\s+le\s+metier\s+([^.;,\n]+?)(?:\s+et\b|[.;,\n]|$)/i);

    const pctGap = pctMatch ? this.normalizePercentFromText(pctMatch[1]) : null;
    const nGap = countsMatch ? this.toNullableInt(countsMatch[1]) : null;
    const totalStudents = countsMatch ? this.toNullableInt(countsMatch[2]) : null;
    const metierName = metierMatch ? String(metierMatch[1]).trim() : null;

    return {
      pctGap,
      nGap,
      totalStudents,
      metierName,
    };
  }

  private extractMetierFromRecommendedCert(value: string): string | null {
    const input = String(value ?? '').trim();
    if (!input) return null;
    const match = input.match(/m[eé]tier\s*cible\s*=\s*(.+)$/i);
    if (!match) return null;
    const metier = String(match[1]).trim();
    return metier || null;
  }

  private priorityFromPct(pct: number): string {
    if (pct >= 80) return 'critique';
    if (pct >= 60) return 'haute';
    if (pct >= 30) return 'moyenne';
    return 'faible';
  }

  private normalizeStatus(value: unknown): RecommendationStatus {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'accepted' || raw === 'rejected' || raw === 'deleted' || raw === 'pending') {
      return raw;
    }
    if (raw === 'confirmed') return 'accepted';
    return 'pending';
  }

  private async loadConfirmedByGaps(gapTitles: string[]): Promise<Map<string, RawConfirmedRecommendationRow>> {
    const normalizedGaps = gapTitles
      .map((value) => String(value ?? '').trim())
      .filter((value) => value.length > 0)
      .slice(0, 500);

    if (normalizedGaps.length === 0) {
      return new Map();
    }

    const { data, error } = await this.withRetry(
      () => this.supabase
        .from('ai_confirmed_recommendations')
        .select('gap_title, level, metier, keywords, concern_rate, students_impacted, llm_recommendation, cert_title, updated_at')
        .in('gap_title', normalizedGaps),
    );

    if (error) {
      this.logger.warn(`Unable to enrich recommendations from ai_confirmed_recommendations: ${error.message}`);
      return new Map();
    }

    const map = new Map<string, RawConfirmedRecommendationRow>();
    const rows = Array.isArray(data) ? (data as RawConfirmedRecommendationRow[]) : [];
    for (const row of rows) {
      const key = this.normalizeGapKeyPart(row.gap_title ?? '');
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, row);
      }
    }

    return map;
  }

  private async loadMetierNamesByIds(targetJobIds: Array<string | null | undefined>): Promise<Map<string, string>> {
    const ids = Array.from(
      new Set(
        targetJobIds
          .map((value) => this.toNullableText(value))
          .filter((value): value is string => Boolean(value)),
      ),
    ).slice(0, 500);

    if (ids.length === 0) {
      return new Map();
    }

    const { data, error } = await this.withRetry(
      () => this.supabase
        .from('metier')
        .select('_id, nom_metier')
        .in('_id', ids),
    );

    if (error) {
      this.logger.warn(`Unable to resolve metier names from metier table: ${error.message}`);
      return new Map();
    }

    const map = new Map<string, string>();
    const rows = Array.isArray(data) ? (data as Array<{ _id: string | null; nom_metier: string | null }>) : [];
    for (const row of rows) {
      const id = this.toNullableText(row._id);
      if (!id) continue;
      map.set(id, this.toNullableText(row.nom_metier) ?? id);
    }

    return map;
  }

  private toRecommendationRow(
    row: RawAiRecommendationRow,
    rank: number,
    confirmedByGap: Map<string, RawConfirmedRecommendationRow>,
    metierNamesById: Map<string, string>,
  ): RecommendationRow {
    const gap = String(row.detected_gap ?? '').trim();
    const confirmed = confirmedByGap.get(this.normalizeGapKeyPart(gap));
    const llmText = String(confirmed?.llm_recommendation ?? row.justification_llm ?? '').trim();
    const certTitle = String(confirmed?.cert_title ?? row.recommended_certs ?? '').trim();
    const parsedSignals = this.parseRecommendationSignals(llmText);
    const metierFromCert = this.extractMetierFromRecommendedCert(certTitle);
    const targetJobId = this.toNullableText(row.target_job_id);
    const metierFromTargetId = targetJobId ? metierNamesById.get(targetJobId) ?? null : null;

    const metier = String(
      confirmed?.metier
      ?? parsedSignals.metierName
      ?? metierFromCert
      ?? metierFromTargetId
      ?? targetJobId
      ?? '',
    ).trim();

    const concernRateRaw = this.toNumber(confirmed?.concern_rate, Number.NaN);
    const concernRate = Number.isFinite(concernRateRaw)
      ? concernRateRaw
      : (parsedSignals.pctGap ?? 0);

    const studentsImpactedRaw = this.toNumber(confirmed?.students_impacted, Number.NaN);
    const studentsImpacted = Number.isFinite(studentsImpactedRaw)
      ? Math.max(0, Math.trunc(studentsImpactedRaw))
      : Math.max(0, Math.trunc(parsedSignals.nGap ?? 0));

    const resolvedPriority = String(confirmed?.level ?? '').trim().toLowerCase();
    const priority = resolvedPriority || this.priorityFromPct(concernRate);

    return {
      id: String(row.id),
      rank_position: rank,
      competence_name: gap,
      metier_name: metier,
      domaine_name: '',
      competence_type: '',
      keywords: String(confirmed?.keywords ?? '').trim(),
      pct_gap: concernRate,
      n_gap: studentsImpacted,
      priority,
      recommended_certification: certTitle,
      recommendation_text: llmText,
      rag_results: [],
      status: this.normalizeStatus(row.status),
      admin_note: null,
      source_collection: 'qdrant',
      generated_at: String(row.created_at ?? row.updated_at ?? new Date().toISOString()),
      created_at: String(row.created_at ?? new Date().toISOString()),
      updated_at: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
      updated_by: null,
    };
  }

  private buildGapKey(item: PythonRecommendationItem): string {
    const competence = this.normalizeGapKeyPart(item.competence);
    const metier = this.normalizeGapKeyPart(item.metier);
    const domaine = this.normalizeGapKeyPart(item.domaine);
    const compType = this.normalizeGapKeyPart(item.competence_type);
    const keywords = this.normalizeGapKeyPart(item.keywords);
    return `${competence}|${metier}|${domaine}|${compType}|${keywords}`;
  }

  private async callRecommendationsPythonService(
    payload: Record<string, unknown>,
  ): Promise<PythonRecommendationsResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.pythonServiceTimeoutMs);

    try {
      const response = await fetch(`${this.pythonServiceUrl}/recommendations/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Recommendations Python service failed (${response.status}): ${text}`,
        );
      }

      return await response.json() as PythonRecommendationsResponse;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(
          `Timed out after ${this.pythonServiceTimeoutMs}ms while calling ${this.pythonServiceUrl}/recommendations/generate`,
        );
      }

      const causeCode = String(err?.cause?.code ?? '').trim();
      if (causeCode === 'ECONNREFUSED') {
        throw new ServiceUnavailableException(
          `Recommendations Python service is not reachable at ${this.pythonServiceUrl}. Start the service and retry.`,
        );
      }

      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateAndPersist(dto: GenerateRecommendationsDto, requestedBy: string): Promise<{
    collection: string;
    totalStudents: number;
    significantGaps: number;
    generated: number;
  }> {
    const payload: Record<string, unknown> = {
      gap_min_pct: dto.gapMinPct,
      top_k: dto.topK,
      max_items: dto.maxItems,
      rag_collection: dto.ragCollection,
      use_llm: dto.useLlm,
    };

    const pythonResponse = await this.withRetry(
      () => this.callRecommendationsPythonService(payload),
      2,
    );

    const generatedAt = String(pythonResponse.generated_at || new Date().toISOString());
    const rows = (pythonResponse.recommendations ?? [])
      .map((item) => ({
        id: randomUUID(),
        cv_submission_id: this.toNullableText(item.cv_submission_id),
        target_job_id: this.toNullableText(item.target_job_id),
        detected_gap: String(item.competence ?? '').trim(),
        recommended_certs: String(item.recommended_certification ?? '').trim(),
        justification_llm: String(item.recommendation_text ?? '').trim(),
        status: 'pending',
        created_at: generatedAt,
        updated_at: new Date().toISOString(),
      }))
      .filter((row) => row.detected_gap.length > 0);

    if (rows.length > 0) {
      const { error } = await this.withRetry(
        () => this.supabase
          .from(this.tableName)
          .insert(rows),
      );

      if (error) {
        this.logger.error(`Failed to persist recommendations: ${error.message}`);
        throw error;
      }
    }

    return {
      collection: String(pythonResponse.qdrant_collection ?? ''),
      totalStudents: Number(pythonResponse.total_students ?? 0),
      significantGaps: Number(pythonResponse.significant_gaps ?? 0),
      generated: rows.length,
    };
  }

  async list(status?: RecommendationStatus): Promise<RecommendationRow[]> {
    let query = this.supabase
      .from(this.tableName)
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(500);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await this.withRetry(() => query);
    if (error) {
      this.logger.error(`Failed to load recommendations: ${error.message}`);
      throw error;
    }

    const rows = Array.isArray(data) ? (data as RawAiRecommendationRow[]) : [];
    if (rows.length === 0) {
      return [];
    }

    const confirmedByGap = await this.loadConfirmedByGaps(rows.map((row) => row.detected_gap));
    const metierNamesById = await this.loadMetierNamesByIds(rows.map((row) => row.target_job_id));
    return rows.map((row, index) => this.toRecommendationRow(row, index + 1, confirmedByGap, metierNamesById));
  }

  async update(
    recommendationId: string,
    dto: UpdateRecommendationDto,
    updatedBy: string,
  ): Promise<RecommendationRow> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.recommendedCertification !== undefined) {
      patch.recommended_certs = dto.recommendedCertification;
    }
    if (dto.recommendationText !== undefined) {
      patch.justification_llm = dto.recommendationText;
    }
    if (dto.status !== undefined) {
      patch.status = dto.status;
    }

    if (Object.keys(patch).length <= 1) {
      throw new BadRequestException('No mutable field provided');
    }

    const { data, error } = await this.withRetry(
      () => this.supabase
        .from(this.tableName)
        .update(patch)
        .eq('id', recommendationId)
        .select('*')
        .single(),
    );

    if (error) {
      this.logger.error(`Failed to update recommendation ${recommendationId}: ${error.message}`);
      throw error;
    }

    const raw = data as RawAiRecommendationRow;
    const confirmedByGap = await this.loadConfirmedByGaps([raw.detected_gap]);
    const metierNamesById = await this.loadMetierNamesByIds([raw.target_job_id]);
    return this.toRecommendationRow(raw, 1, confirmedByGap, metierNamesById);
  }

  async remove(
    recommendationId: string,
    hardDelete: boolean,
    updatedBy: string,
  ): Promise<{ id: string; deleted: boolean; hardDelete: boolean }> {
    if (hardDelete) {
      const { error } = await this.withRetry(
        () => this.supabase
          .from(this.tableName)
          .delete()
          .eq('id', recommendationId),
      );

      if (error) {
        this.logger.error(`Failed to hard delete recommendation ${recommendationId}: ${error.message}`);
        throw error;
      }

      return {
        id: recommendationId,
        deleted: true,
        hardDelete: true,
      };
    }

    const { error } = await this.withRetry(
      () => this.supabase
        .from(this.tableName)
        .update({
          status: 'deleted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', recommendationId),
    );

    if (error) {
      this.logger.error(`Failed to soft delete recommendation ${recommendationId}: ${error.message}`);
      throw error;
    }

    return {
      id: recommendationId,
      deleted: true,
      hardDelete: false,
    };
  }
}
