import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { getSupabase } from '../config/supabase.client';

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'edited';

export type RecommendationRow = Record<string, any>;

type StudentGapCompetence = {
  competenceName: string;
  normalizedCompetence: string;
  similarityScore: number;
  level: 'CRITIQUE' | 'MOYEN' | 'FAIBLE';
};

@Injectable()
export class RecommendationsService {
  private readonly logger = new Logger(RecommendationsService.name);
  private readonly supabase = getSupabase();
  private readonly uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  private readonly pythonServiceUrl: string;
  private readonly pythonTimeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.pythonServiceUrl = (
      this.configService.get<string>('RECOMMENDATION_PYTHON_SERVICE_URL')
      ?? 'http://127.0.0.1:8002'
    ).replace(/\/+$/, '');

    const timeout = Number(this.configService.get<string>('RECOMMENDATION_PYTHON_TIMEOUT_MS') ?? '900000');
    this.pythonTimeoutMs = Number.isFinite(timeout) ? Math.max(60_000, timeout) : 900_000;
  }

  private async pythonPost(path: string, body: any): Promise<any> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.pythonTimeoutMs);
    try {
      const response = await fetch(`${this.pythonServiceUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new HttpException(
          `Python recommendation service failed (${response.status}): ${text}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return text ? JSON.parse(text) : {};
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      if (err?.name === 'AbortError') {
        throw new HttpException(
          `Python recommendation service timed out (${this.pythonTimeoutMs}ms)`,
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      throw new HttpException(
        `Unable to reach recommendation service: ${err?.message ?? err}`,
        HttpStatus.BAD_GATEWAY,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async triggerGeneration(triggeredBy: string | null): Promise<{ jobId: string; status: string }> {
    const jobId = `job_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    this.logger.log(`Triggering generation job ${jobId} (by=${triggeredBy ?? 'unknown'})`);

    const response = await this.pythonPost('/generate', {
      job_id: jobId,
      triggered_by: triggeredBy,
      wait: false,
    });

    return { jobId: response?.job_id ?? jobId, status: response?.status ?? 'running' };
  }

  async getJob(jobId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('recommendation_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    if (!data) throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    return data;
  }

  async listJobs(limit = 20): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('recommendation_jobs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data ?? [];
  }

  async listRecommendations(status?: string): Promise<RecommendationRow[]> {
    const normalizedStatus = (status ?? '').trim().toLowerCase();

    if (normalizedStatus === 'approved') {
      return this.listApprovedRecommendationsForAdmin();
    }

    let query = this.supabase
      .from('ai_recommendations')
      .select('*')
      // Business priority: lower popularity_rank means higher priority (1 highest, 99 lowest).
      .order('popularity_rank', { ascending: true, nullsFirst: false })
      .order('concern_rate', { ascending: false });
    if (normalizedStatus) {
      query = query.eq('status', normalizedStatus);
    }
    const { data, error } = await query;
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    const rows = (data ?? []) as RecommendationRow[];
    if (normalizedStatus) {
      return rows;
    }

    // For "all", include approved rows from the confirmed table (source of truth)
    // so previously validated recommendations remain visible even after regeneration.
    const approvedRows = await this.listApprovedRecommendationsForAdmin();
    const approvedIds = new Set(approvedRows.map((r) => String(r.id).trim()));
    const nonApproved = rows.filter((r) => !approvedIds.has(String(r?.id ?? '').trim()));
    return [...approvedRows, ...nonApproved];
  }

  private async listApprovedRecommendationsForAdmin(): Promise<RecommendationRow[]> {
    const confirmedRows = await this.listAllConfirmedRecommendations();
    return confirmedRows
      .map((row: any) => ({
        ...row,
        id: String(row?.recommendation_id ?? row?.id ?? '').trim(),
        status: 'approved',
        created_at: row?.created_at ?? row?.confirmed_at ?? null,
        updated_at: row?.updated_at ?? row?.confirmed_at ?? null,
      }))
      .filter((row: RecommendationRow) => !!row.id);
  }

  async listApprovedRecommendationsForStudent(authOrUserId: string): Promise<RecommendationRow[]> {
    const resolvedAuthId = await this.resolveStudentAuthId(authOrUserId);
    if (!resolvedAuthId) return [];

    const targetJob = await this.getStudentTargetJob(resolvedAuthId);
    if (!targetJob) return [];

    // Requirement: student recommendations come from confirmed rows only, mapped by
    // ai_confirmed_recommendations.metier <-> cv_submissions.professional_title.
    const allConfirmed = await this.listAllConfirmedRecommendations();
    const byTargetJob = allConfirmed.filter((row) => this.isMetierMatch(row?.metier, targetJob));
    if (byTargetJob.length === 0) return [];

    const studentGaps = await this.listStudentGapCompetences(resolvedAuthId, targetJob);
    const mappedRows = byTargetJob
      .map((row) => {
        const gap = this.findBestGapCompetenceForRecommendation(row, studentGaps);
        return gap
          ? this.toStudentRecommendation(row, gap)
          : null;
      })
      .filter((row): row is RecommendationRow => row !== null)
      .sort((left, right) => this.compareStudentRecommendations(left, right));

    if (mappedRows.length > 0) {
      return mappedRows;
    }

    // Fallback when naming mismatch prevents competence mapping.
    return byTargetJob
      .map((row) => this.toStudentRecommendation(row, null))
      .sort((left, right) => this.compareStudentRecommendations(left, right));
  }

  private async listAllConfirmedRecommendations(): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('ai_confirmed_recommendations')
      .select('*')
      .order('concern_rate', { ascending: false });
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    return data ?? [];
  }

  private async resolveStudentAuthId(authOrUserId: string): Promise<string | null> {
    const normalized = String(authOrUserId ?? '').trim();
    if (!normalized) return null;

    if (this.uuidPattern.test(normalized)) {
      const { data: cvRow, error: cvError } = await this.supabase
        .from('cv_submissions')
        .select('auth_id')
        .eq('auth_id', normalized)
        .maybeSingle();
      if (cvError) throw new HttpException(cvError.message, HttpStatus.INTERNAL_SERVER_ERROR);
      if (cvRow?.auth_id) return String(cvRow.auth_id).trim();
    }

    const { data: userRow, error: userError } = await this.supabase
      .from('user')
      .select('auth_id')
      .eq('id', normalized)
      .maybeSingle();
    if (userError) throw new HttpException(userError.message, HttpStatus.INTERNAL_SERVER_ERROR);

    const fromUser = String(userRow?.auth_id ?? '').trim();
    if (fromUser) return fromUser;

    return this.uuidPattern.test(normalized) ? normalized : null;
  }

  private async getStudentTargetJob(authId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('cv_submissions')
      .select('professional_title')
      .eq('auth_id', authId)
      .maybeSingle();
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    const targetJob = String(data?.professional_title ?? '').trim();
    return targetJob || null;
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  }

  private isMetierMatch(metier: unknown, professionalTitle: unknown): boolean {
    const normalizedMetier = this.normalizeText(metier);
    const normalizedTitle = this.normalizeText(professionalTitle);
    if (!normalizedMetier || !normalizedTitle) return false;

    if (normalizedMetier === normalizedTitle) return true;
    if (normalizedMetier.includes(normalizedTitle) || normalizedTitle.includes(normalizedMetier)) return true;

    const metierTokens = normalizedMetier.split(' ').filter(Boolean);
    const titleTokens = new Set(normalizedTitle.split(' ').filter(Boolean));
    const commonTokenCount = metierTokens.filter((token) => titleTokens.has(token)).length;

    return commonTokenCount >= 2;
  }

  private mapSimilarityToStudentLevel(similarityScore: number): 'CRITIQUE' | 'MOYEN' | 'FAIBLE' {
    const safeScore = Number.isFinite(similarityScore)
      ? Math.max(0, Math.min(1, similarityScore))
      : 1;

    // Lower similarity means a stronger competence gap for the student.
    if (safeScore < 0.30) return 'CRITIQUE';
    if (safeScore < 0.50) return 'MOYEN';
    return 'FAIBLE';
  }

  private async listStudentGapCompetences(authId: string, targetJob: string): Promise<StudentGapCompetence[]> {
    const { data, error } = await this.supabase
      .from('cv_matching_competence_results')
      .select('competence_name, similarity_score, metier_name, is_top_metier')
      .eq('auth_id', authId)
      .eq('status', 'gap');
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    const rows = (data ?? [])
      .map((row: any) => {
        const competenceName = String(row?.competence_name ?? '').trim();
        const normalizedCompetence = this.normalizeText(competenceName);
        const similarityScore = Number(row?.similarity_score ?? NaN);

        if (!competenceName || !normalizedCompetence || !Number.isFinite(similarityScore)) {
          return null;
        }

        const safeSimilarityScore = Math.max(0, Math.min(1, similarityScore));
        return {
          competenceName,
          normalizedCompetence,
          similarityScore: Number(safeSimilarityScore.toFixed(4)),
          metierName: String(row?.metier_name ?? '').trim(),
          isTopMetier: row?.is_top_metier === true,
        };
      })
      .filter((row): row is {
        competenceName: string;
        normalizedCompetence: string;
        similarityScore: number;
        metierName: string;
        isTopMetier: boolean;
      } => row !== null);

    if (rows.length === 0) return [];

    const metierScoped = rows.filter((row) => this.isMetierMatch(row.metierName, targetJob));
    const topMetierScoped = rows.filter((row) => row.isTopMetier);
    const source = metierScoped.length > 0
      ? metierScoped
      : (topMetierScoped.length > 0 ? topMetierScoped : rows);

    const bestByCompetence = new Map<string, StudentGapCompetence>();

    for (const row of source) {
      const existing = bestByCompetence.get(row.normalizedCompetence);
      if (!existing || row.similarityScore < existing.similarityScore) {
        bestByCompetence.set(row.normalizedCompetence, {
          competenceName: row.competenceName,
          normalizedCompetence: row.normalizedCompetence,
          similarityScore: row.similarityScore,
          level: this.mapSimilarityToStudentLevel(row.similarityScore),
        });
      }
    }

    return Array.from(bestByCompetence.values());
  }

  private computeTextOverlap(left: string, right: string): number {
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.includes(right) || right.includes(left)) return 0.92;

    const leftTokens = left.split(' ').filter((token) => token.length > 2);
    const rightTokens = right.split(' ').filter((token) => token.length > 2);
    if (leftTokens.length === 0 || rightTokens.length === 0) return 0;

    const leftSet = new Set(leftTokens);
    const rightSet = new Set(rightTokens);
    let common = 0;

    for (const token of leftSet) {
      if (rightSet.has(token)) {
        common += 1;
      }
    }

    if (common === 0) return 0;
    const union = new Set([...leftSet, ...rightSet]).size;
    return union > 0 ? common / union : 0;
  }

  private findBestGapCompetenceForRecommendation(
    recommendation: any,
    studentGaps: StudentGapCompetence[],
  ): StudentGapCompetence | null {
    if (!Array.isArray(studentGaps) || studentGaps.length === 0) {
      return null;
    }

    const candidates = [
      recommendation?.gap_title,
      recommendation?.gap_label,
      recommendation?.competence_name,
      recommendation?.detected_gap,
    ]
      .map((value) => this.normalizeText(value))
      .filter((value) => value.length > 0);

    if (candidates.length === 0) {
      return null;
    }

    let bestMatch: { gap: StudentGapCompetence; score: number } | null = null;

    for (const gap of studentGaps) {
      for (const candidate of candidates) {
        const score = this.computeTextOverlap(candidate, gap.normalizedCompetence);
        if (score <= 0) continue;

        const shouldReplace = !bestMatch
          || score > bestMatch.score
          || (score === bestMatch.score && gap.similarityScore < bestMatch.gap.similarityScore);

        if (shouldReplace) {
          bestMatch = { gap, score };
        }
      }
    }

    if (!bestMatch || bestMatch.score < 0.34) {
      return null;
    }

    return bestMatch.gap;
  }

  private normalizeRecommendationLevel(level: unknown): 'CRITIQUE' | 'MOYEN' | 'FAIBLE' {
    const normalized = String(level ?? '').trim().toUpperCase();
    if (normalized === 'CRITIQUE') return 'CRITIQUE';
    if (normalized === 'FAIBLE') return 'FAIBLE';
    if (normalized === 'HAUTE' || normalized === 'MOYENNE' || normalized === 'MOYEN') return 'MOYEN';
    return 'MOYEN';
  }

  private compareStudentRecommendations(left: RecommendationRow, right: RecommendationRow): number {
    const leftSimilarity = Number(left.student_similarity_score);
    const rightSimilarity = Number(right.student_similarity_score);
    const leftHasSimilarity = Number.isFinite(leftSimilarity);
    const rightHasSimilarity = Number.isFinite(rightSimilarity);

    if (leftHasSimilarity && rightHasSimilarity && leftSimilarity !== rightSimilarity) {
      return leftSimilarity - rightSimilarity;
    }

    if (leftHasSimilarity && !rightHasSimilarity) return -1;
    if (!leftHasSimilarity && rightHasSimilarity) return 1;

    const leftRate = Number(left.concern_rate);
    const rightRate = Number(right.concern_rate);
    const safeLeftRate = Number.isFinite(leftRate) ? leftRate : 0;
    const safeRightRate = Number.isFinite(rightRate) ? rightRate : 0;

    return safeRightRate - safeLeftRate;
  }

  private toStudentRecommendation(row: any, studentGap: StudentGapCompetence | null): RecommendationRow {
    const recommendationId = String(row?.recommendation_id ?? row?.id ?? '').trim();
    const similarityScore = studentGap
      ? Number(studentGap.similarityScore.toFixed(4))
      : null;

    return {
      ...row,
      id: recommendationId,
      level: studentGap?.level ?? this.normalizeRecommendationLevel(row?.level),
      student_similarity_score: similarityScore,
      student_competence_name: studentGap?.competenceName ?? null,
    };
  }

  async getRecommendation(id: string): Promise<RecommendationRow> {
    const { data, error } = await this.supabase
      .from('ai_recommendations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    if (!data) throw new HttpException('Recommendation not found', HttpStatus.NOT_FOUND);
    return data;
  }

  async updateRecommendation(
    id: string,
    patch: Partial<RecommendationRow>,
  ): Promise<RecommendationRow> {
    const allowed: (keyof RecommendationRow)[] = [
      'category',
      'level',
      'metier',
      'metier_id',
      'domaine',
      'competence_name',
      'competence_type',
      'keywords',
      'gap_label',
      'gap_title',
      'concern_rate',
      'students_impacted',
      'cohort_size',
      'total_students',
      'popularity_rank',
      'llm_recommendation',
      'cert_title',
      'cert_description',
      'cert_provider',
      'cert_duration',
      'cert_pricing',
      'cert_url',
      'cert_id',
      'match_confidence',
      'recommended_certs',
      'justification_llm',
      'detected_gap',
    ];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) update[key] = patch[key];
    }
    update.status = 'edited';
    update.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('ai_recommendations')
      .update(update)
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    if (!data) throw new HttpException('Recommendation not found', HttpStatus.NOT_FOUND);

    // If an approved recommendation is edited, it must leave the confirmed pool
    // until an explicit re-approval happens.
    await this.removeConfirmedMirror(id);

    return data;
  }

  async rejectRecommendation(id: string, adminId: string | null, comment?: string): Promise<void> {
    const { error } = await this.supabase
      .from('ai_recommendations')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);

    // A rejected recommendation must not remain in confirmed tables.
    await this.removeConfirmedMirror(id);

    await this.logAdminFeedback(id, adminId, 'rejected', '', comment);
  }

  private async removeConfirmedMirror(recommendationId: string): Promise<void> {
    const { error: targetError } = await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .delete()
      .eq('recommendation_id', recommendationId);
    if (targetError) throw new HttpException(targetError.message, HttpStatus.INTERNAL_SERVER_ERROR);

    const { error: confirmedError } = await this.supabase
      .from('ai_confirmed_recommendations')
      .delete()
      .eq('recommendation_id', recommendationId);
    if (confirmedError) throw new HttpException(confirmedError.message, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  async approveRecommendation(id: string, adminId: string | null, comment?: string): Promise<RecommendationRow> {
    const row = await this.getRecommendation(id);

    const confirmed = {
      recommendation_id: row.id,
      category: row.category ?? 'TARGET_METIER',
      gap_label: row.gap_label ?? row.competence_name ?? 'N/A',
      gap_title: row.gap_title ?? row.competence_name ?? 'N/A',
      level: row.level ?? 'MOYENNE',
      metier: row.metier ?? 'N/A',
      keywords: row.keywords ?? [],
      concern_rate: Number(row.concern_rate ?? 0),
      students_impacted: Number(row.students_impacted ?? 0),
      total_students: Number(row.total_students ?? 0),
      llm_recommendation: row.llm_recommendation ?? '',
      cert_title: row.cert_title ?? 'N/A',
      cert_description: row.cert_description ?? null,
      cert_provider: row.cert_provider ?? 'N/A',
      cert_duration: row.cert_duration ?? 'N/A',
      cert_pricing: row.cert_pricing ?? 'N/A',
      cert_url: row.cert_url ?? null,
      cert_id: row.cert_id ?? null,
      match_confidence: row.match_confidence ?? null,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await this.supabase
      .from('ai_confirmed_recommendations')
      .upsert(confirmed, { onConflict: 'recommendation_id' });
    if (upsertErr) throw new HttpException(upsertErr.message, HttpStatus.INTERNAL_SERVER_ERROR);

    // Copy impacted targets
    const { data: targets, error: targetsErr } = await this.supabase
      .from('ai_recommendation_targets')
      .select('auth_id')
      .eq('recommendation_id', row.id);
    if (targetsErr) throw new HttpException(targetsErr.message, HttpStatus.INTERNAL_SERVER_ERROR);

    const confirmedTargets = (targets ?? []).map((t: any) => ({
      recommendation_id: row.id,
      auth_id: t.auth_id,
    }));

    if (confirmedTargets.length) {
      const { error: tErr } = await this.supabase
        .from('ai_confirmed_recommendation_targets')
        .upsert(confirmedTargets, { onConflict: 'recommendation_id,auth_id' });
      if (tErr) this.logger.warn(`confirmed targets upsert failed: ${tErr.message}`);
    }

    const { error: statusErr } = await this.supabase
      .from('ai_recommendations')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (statusErr) throw new HttpException(statusErr.message, HttpStatus.INTERNAL_SERVER_ERROR);

    await this.logAdminFeedback(row.id, adminId, 'approved', row.cert_title ?? '', comment);

    return { ...row, status: 'approved' };
  }

  private async logAdminFeedback(
    recommendationId: string,
    adminId: string | null,
    action: 'approved' | 'rejected' | 'edited',
    finalCerts: string,
    comment?: string,
  ): Promise<void> {
    try {
      const nowIso = new Date().toISOString();
      await this.supabase.from('admin_feedback').insert({
        id: `fb_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
        recommendation_id: recommendationId,
        admin_id: adminId,
        action_taken: action,
        final_certs: finalCerts,
        admin_comment: comment ?? '',
        created_at: nowIso,
      });
    } catch (err: any) {
      this.logger.warn(`admin_feedback insert failed: ${err?.message ?? err}`);
    }
  }
}
