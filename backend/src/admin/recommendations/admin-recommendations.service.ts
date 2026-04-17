import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../../config/supabase.client';
import {
  CertificationPayload,
  GapStatisticsPayload,
  RagKnowledgePayload,
  RecommendationItem,
  RecommendationLevel,
  RecommendationOverride,
} from './admin-recommendations.types';

type QdrantScrollPoint = {
  id: string | number;
  payload?: Record<string, unknown>;
};

type QdrantScrollResponse = {
  points: QdrantScrollPoint[];
  nextPageOffset: string | number | null;
};

type ResolvedRecommendation = {
  item: RecommendationItem;
  gap: GapStatisticsPayload;
};

@Injectable()
export class AdminRecommendationsService {
  private readonly logger = new Logger(AdminRecommendationsService.name);
  private readonly qdrantUrl: string;
  private readonly qdrantApiKey?: string;
  private readonly groqApiKey?: string;
  private readonly groqModel: string;
  private readonly minGapPct: number;
  private readonly maxRecommendations: number;
  private readonly gapScanLimit: number;
  private readonly supabase: SupabaseClient;
  private readonly overrides = new Map<string, RecommendationOverride>();
  private readonly latestResolvedById = new Map<string, ResolvedRecommendation>();

  constructor(private readonly configService: ConfigService) {
    this.qdrantUrl =
      this.configService.get<string>('QDRANT_URL') ??
      'https://4252fbd0-800c-46ef-9748-3e52c7b9f434.eu-central-1-0.aws.cloud.qdrant.io';
    this.qdrantApiKey = this.configService.get<string>('QDRANT_API_KEY');
    this.groqApiKey = this.configService.get<string>('GROQ_API_KEY');
    this.groqModel =
      this.configService.get<string>('GROQ_MODEL') ?? 'llama-3.1-8b-instant';
    this.minGapPct = this.parseNumberEnv('ADMIN_RAG_MIN_GAP_PCT', 0, true);
    this.maxRecommendations = this.parseNumberEnv(
      'ADMIN_RAG_MAX_RECOMMENDATIONS',
      10000,
    );
    this.gapScanLimit = this.parseNumberEnv('ADMIN_RAG_GAP_SCAN_LIMIT', 10000);
    this.supabase = getSupabase();
  }

  async getAiCertifications(): Promise<RecommendationItem[]> {
    const [gapStats, ragDocs] = await Promise.all([
      this.fetchTopGapStatistics(this.gapScanLimit),
      this.fetchRagKnowledgeDocs(500),
    ]);

    if (gapStats.length === 0) {
      return this.buildFallbackRecommendations();
    }

    const filteredGaps = gapStats.filter(
      (gap) => this.toNumber(gap.pct_students) >= this.minGapPct,
    );

    const topGaps = this.maxRecommendations > 0
      ? filteredGaps.slice(0, this.maxRecommendations)
      : filteredGaps;

    const adaptiveLevels = this.resolveLevelsForGaps(topGaps);

    const recommendationPromises = topGaps.map(async (gap, index) => {
      const recommendation = await this.buildRecommendation(
        gap,
        ragDocs,
        index,
        adaptiveLevels[index],
      );
      const override = this.overrides.get(recommendation.id);

      if (!override) {
        return {
          item: recommendation,
          gap,
        };
      }

      const resolvedItem = {
        ...recommendation,
        certification: override.certification ?? recommendation.certification,
        status: override.status ?? recommendation.status,
      };

      return {
        item: resolvedItem,
        gap,
      };
    });

    const resolvedItems = await Promise.all(recommendationPromises);
    this.latestResolvedById.clear();
    for (const resolved of resolvedItems) {
      this.latestResolvedById.set(resolved.item.id, resolved);
    }

    return resolvedItems.map((entry) => entry.item);
  }

  async generateAiCertifications(): Promise<RecommendationItem[]> {
    return this.getAiCertifications();
  }

  async updateCertification(
    id: string,
    certification: CertificationPayload,
  ): Promise<void> {
    const current = this.overrides.get(id) ?? {};
    this.overrides.set(id, {
      ...current,
      certification,
      status: 'PENDING',
    });
  }

  async confirmRecommendation(id: string): Promise<void> {
    const resolved = await this.resolveRecommendationById(id);
    if (resolved) {
      await this.persistConfirmedRecommendation(resolved.item, resolved.gap);
    }

    const current = this.overrides.get(id) ?? {};
    this.overrides.set(id, {
      ...current,
      status: 'CONFIRMED',
    });
  }

  async deleteRecommendation(id: string): Promise<void> {
    await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .delete()
      .eq('recommendation_id', id);

    await this.supabase
      .from('ai_confirmed_recommendations')
      .delete()
      .eq('recommendation_id', id);

    const current = this.overrides.get(id) ?? {};
    this.overrides.set(id, {
      ...current,
      status: 'DELETED',
    });
  }

  async getConfirmedRecommendationsForStudent(
    authId: string,
  ): Promise<RecommendationItem[]> {
    const normalizedAuthId = authId.trim();
    if (!normalizedAuthId) {
      return [];
    }

    const { data: targetRows, error: targetErr } = await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .select('recommendation_id')
      .eq('auth_id', normalizedAuthId);

    if (targetErr) {
      this.logger.warn(
        `Unable to load recommendation targets for student ${normalizedAuthId}: ${targetErr.message}`,
      );
      return [];
    }

    const recommendationIds = (targetRows ?? [])
      .map((row: any) => String(row?.recommendation_id ?? '').trim())
      .filter((id: string) => id.length > 0);

    if (recommendationIds.length === 0) {
      return [];
    }

    const { data: recRows, error: recErr } = await this.supabase
      .from('ai_confirmed_recommendations')
      .select('*')
      .in('recommendation_id', recommendationIds)
      .order('confirmed_at', { ascending: false });

    if (recErr) {
      this.logger.warn(
        `Unable to load confirmed recommendations for student ${normalizedAuthId}: ${recErr.message}`,
      );
      return [];
    }

    return (recRows ?? []).map((row: any) => ({
      id: String(row.recommendation_id),
      category: String(row.category ?? ''),
      gapLabel: String(row.gap_label ?? ''),
      gapTitle: String(row.gap_title ?? ''),
      level: this.normalizeLevel(row.level),
      metier: String(row.metier ?? ''),
      keywords: Array.isArray(row.keywords)
        ? row.keywords.map((kw: unknown) => String(kw))
        : [],
      concernRate: this.toNumber(row.concern_rate),
      studentsImpacted: this.toNumber(row.students_impacted),
      totalStudents: this.toNumber(row.total_students),
      llmRecommendation: String(row.llm_recommendation ?? ''),
      certification: {
        title: String(row.cert_title ?? ''),
        description: String(row.cert_description ?? ''),
        provider: String(row.cert_provider ?? ''),
        duration: String(row.cert_duration ?? ''),
        pricing: String(row.cert_pricing ?? ''),
        url: String(row.cert_url ?? ''),
      },
      status: 'CONFIRMED',
    }));
  }

  private async resolveRecommendationById(
    id: string,
  ): Promise<ResolvedRecommendation | null> {
    const cached = this.latestResolvedById.get(id);
    if (cached) {
      return cached;
    }

    await this.getAiCertifications();
    return this.latestResolvedById.get(id) ?? null;
  }

  private async persistConfirmedRecommendation(
    item: RecommendationItem,
    gap: GapStatisticsPayload,
  ): Promise<void> {
    const upsertPayload = {
      recommendation_id: item.id,
      category: item.category,
      gap_label: item.gapLabel,
      gap_title: item.gapTitle,
      level: item.level,
      metier: item.metier,
      keywords: item.keywords,
      concern_rate: item.concernRate,
      students_impacted: item.studentsImpacted,
      total_students: item.totalStudents,
      llm_recommendation: item.llmRecommendation,
      cert_title: item.certification.title,
      cert_description: item.certification.description ?? '',
      cert_provider: item.certification.provider,
      cert_duration: item.certification.duration,
      cert_pricing: item.certification.pricing,
      cert_url: item.certification.url ?? '',
      updated_at: new Date().toISOString(),
      confirmed_at: new Date().toISOString(),
    };

    const { error: upsertErr } = await this.supabase
      .from('ai_confirmed_recommendations')
      .upsert(upsertPayload, { onConflict: 'recommendation_id' });

    if (upsertErr) {
      this.logger.warn(
        `Unable to upsert confirmed recommendation ${item.id}: ${upsertErr.message}`,
      );
      return;
    }

    const studentIds = this.parseStudentIds(gap.student_ids);

    const { error: deleteTargetsErr } = await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .delete()
      .eq('recommendation_id', item.id);

    if (deleteTargetsErr) {
      this.logger.warn(
        `Unable to clear recommendation targets ${item.id}: ${deleteTargetsErr.message}`,
      );
      return;
    }

    if (studentIds.length === 0) {
      return;
    }

    const targetRows = studentIds.map((studentId) => ({
      recommendation_id: item.id,
      auth_id: studentId,
    }));

    const { error: insertTargetsErr } = await this.supabase
      .from('ai_confirmed_recommendation_targets')
      .insert(targetRows);

    if (insertTargetsErr) {
      this.logger.warn(
        `Unable to insert recommendation targets ${item.id}: ${insertTargetsErr.message}`,
      );
    }
  }

  private async buildRecommendation(
    gap: GapStatisticsPayload,
    ragDocs: RagKnowledgePayload[],
    index: number,
    forcedLevel?: RecommendationLevel,
  ): Promise<RecommendationItem> {
    const competenceName = this.toText(gap.competence_name, 'Gap non defini');
    const metierName = this.toText(gap.metier_name, 'Metier non defini');
    const domaineName = this.toText(gap.domaine_name, 'General');
    const competenceType = this.toText(gap.competence_type, 'Non precise');
    const keywords = this.parseKeywords(gap.keywords);
    const concernRate = this.toNumber(gap.pct_students);
    const studentsImpacted = this.toNumber(gap.n_gap);
    const totalStudents = this.toNumber(gap.n_students_total);

    const level = forcedLevel ?? this.resolveLevel(concernRate);
    const certification = this.pickBestCertification(gap, ragDocs);
    const llmRecommendation = await this.generateRecommendationText(
      {
        competenceName,
        metierName,
        domaineName,
        competenceType,
        concernRate,
        studentsImpacted,
        totalStudents,
        keywords,
      },
      certification,
    );

    return {
      id: this.buildRecommendationId(index, competenceName, metierName),
      category: domaineName,
      gapLabel: competenceType,
      gapTitle: competenceName,
      level,
      metier: metierName,
      keywords,
      concernRate,
      studentsImpacted,
      totalStudents,
      llmRecommendation,
      certification,
      status: 'PENDING',
    };
  }

  private async fetchTopGapStatistics(
    limit: number,
  ): Promise<GapStatisticsPayload[]> {
    const pageSize = Math.min(500, Math.max(100, limit));
    const allPoints: QdrantScrollPoint[] = [];
    let offset: string | number | null = null;

    while (allPoints.length < limit) {
      const response = await this.qdrantScroll('gap_statistics', {
        limit: Math.min(pageSize, limit - allPoints.length),
        with_payload: true,
        ...(offset !== null ? { offset } : {}),
      });

      if (response.points.length === 0) {
        break;
      }

      allPoints.push(...response.points);
      offset = response.nextPageOffset;

      if (offset === null) {
        break;
      }
    }

    const rows = allPoints
      .map((point) => (point.payload ?? {}) as GapStatisticsPayload)
      .sort(
        (a, b) => this.toNumber(b.pct_students) - this.toNumber(a.pct_students),
      );

    return rows;
  }

  private async fetchRagKnowledgeDocs(
    limit: number,
  ): Promise<RagKnowledgePayload[]> {
    const response = await this.qdrantScroll('rag_knowledge', {
      limit,
      with_payload: true,
      filter: {
        should: [
          { key: 'doc_type', match: { value: 'certification' } },
          { key: 'doc_type', match: { value: 'rncp_certification' } },
          { key: 'doc_type', match: { value: 'aft_referentiel' } },
          { key: 'doc_type', match: { value: 'recommendation_rule' } },
        ],
      },
    });

    return response.points.map(
      (point) => (point.payload ?? {}) as RagKnowledgePayload,
    );
  }

  private pickBestCertification(
    gap: GapStatisticsPayload,
    ragDocs: RagKnowledgePayload[],
  ): CertificationPayload {
    if (ragDocs.length === 0) {
      return this.buildFallbackCertification(gap);
    }

    const gapQuery = [
      this.toText(gap.competence_name),
      this.toText(gap.keywords),
      this.toText(gap.metier_name),
      this.toText(gap.competence_type),
    ]
      .filter((value) => value.length > 0)
      .join(' ');

    const queryTokens = new Set(this.tokenize(gapQuery));

    let bestDoc: RagKnowledgePayload | null = null;
    let bestScore = -1;

    for (const doc of ragDocs) {
      const candidateText = [
        this.toText(doc.titre),
        this.toText(doc.text),
        this.toText(doc.competences),
        this.toText(doc.metier),
        this.toText(doc.recommande_pour),
        this.toText(doc.certifications),
      ].join(' ');

      const candidateTokens = this.tokenize(candidateText);
      const overlap = candidateTokens.filter((token) => queryTokens.has(token))
        .length;

      const normalizedScore =
        overlap / Math.max(6, Math.min(30, candidateTokens.length));

      const docTypeBoost = this.getDocTypeBoost(this.toText(doc.doc_type));
      const metadataBoost = this.getMetadataCompletenessBoost(doc);
      const finalScore = normalizedScore + docTypeBoost + metadataBoost;

      if (finalScore > bestScore) {
        bestDoc = doc;
        bestScore = finalScore;
      }
    }

    if (!bestDoc || bestScore <= 0) {
      return this.buildFallbackCertification(gap);
    }

    return {
      title: this.toText(bestDoc.titre, 'Certification recommandee'),
      description: this.toText(bestDoc.text, ''),
      provider: this.toText(
        bestDoc.plateforme,
        this.toText(bestDoc.source, 'Plateforme non precise'),
      ),
      duration: this.toText(
        bestDoc.duree_heures,
        this.toText(
          bestDoc.duree,
          this.toText(bestDoc.niveau, 'Duree non indiquee dans RAG_MASTER'),
        ),
      ),
      pricing: this.toText(
        bestDoc.cout,
        `Non indiquee dans la source (${this.toText(bestDoc.source, 'RAG')})`,
      ),
      url: this.toText(bestDoc.url, ''),
    };
  }

  private getDocTypeBoost(docType: string): number {
    if (docType === 'certification') return 0.4;
    if (docType === 'rncp_certification') return 0.2;
    if (docType === 'aft_referentiel') return 0.1;
    if (docType === 'recommendation_rule') return 0.05;
    return 0;
  }

  private getMetadataCompletenessBoost(doc: RagKnowledgePayload): number {
    let score = 0;
    if (this.toText(doc.plateforme).length > 0) score += 0.08;
    if (this.toText(doc.duree_heures).length > 0 || this.toText(doc.duree).length > 0) score += 0.07;
    if (this.toText(doc.cout).length > 0) score += 0.06;
    if (this.toText(doc.url).length > 0) score += 0.04;
    return score;
  }

  private async generateRecommendationText(
    gapInfo: {
      competenceName: string;
      metierName: string;
      domaineName: string;
      competenceType: string;
      concernRate: number;
      studentsImpacted: number;
      totalStudents: number;
      keywords: string[];
    },
    certification: CertificationPayload,
  ): Promise<string> {
    if (!this.groqApiKey) {
      return this.buildFallbackRecommendationText(gapInfo, certification);
    }

    const prompt = [
      'Tu es un conseiller pedagogique ISGIS.',
      `Gap: ${gapInfo.competenceName}`,
      `Metier: ${gapInfo.metierName}`,
      `Domaine: ${gapInfo.domaineName}`,
      `Type: ${gapInfo.competenceType}`,
      `Impact: ${gapInfo.concernRate}% (${gapInfo.studentsImpacted}/${gapInfo.totalStudents})`,
      `Mots-cles: ${gapInfo.keywords.join(', ')}`,
      `Certification candidate: ${certification.title} | ${certification.provider}`,
      'Reponds en francais en 4 lignes: constat, recommandation, justification, action immediate.',
    ].join('\n');

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.groqModel,
          temperature: 0.3,
          max_tokens: 250,
          messages: [
            {
              role: 'system',
              content:
                'Tu generes des recommandations pedagogiques precises, courtes et actionnables.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        this.logger.warn(
          `Groq request failed (${response.status}), fallback used: ${body}`,
        );
        return this.buildFallbackRecommendationText(gapInfo, certification);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        return this.buildFallbackRecommendationText(gapInfo, certification);
      }

      return content;
    } catch (error) {
      this.logger.warn(
        `Groq generation error, fallback used: ${String(error)}`,
      );
      return this.buildFallbackRecommendationText(gapInfo, certification);
    }
  }

  private buildFallbackRecommendationText(
    gapInfo: {
      competenceName: string;
      metierName: string;
      concernRate: number;
      studentsImpacted: number;
      totalStudents: number;
    },
    certification: CertificationPayload,
  ): string {
    return [
      `${gapInfo.concernRate}% des etudiants (${gapInfo.studentsImpacted}/${gapInfo.totalStudents}) ont un gap en ${gapInfo.competenceName}.`,
      `Certification recommandee: ${certification.title} (${certification.provider}).`,
      `Ce parcours cible le metier ${gapInfo.metierName} et reduit rapidement l'ecart prioritaire identifie.`,
      'Action: lancer un micro-cohort pilote des cette semaine avec suivi des acquis.',
    ].join(' ');
  }

  private buildFallbackCertification(
    gap: GapStatisticsPayload,
  ): CertificationPayload {
    return {
      title: `Parcours cible - ${this.toText(gap.competence_name, 'Competence prioritaire')}`,
      description: `Parcours recommande pour renforcer ${this.toText(gap.competence_name, 'la competence')} sur le metier ${this.toText(gap.metier_name, 'cible')}.`,
      provider: 'ISGIS / Partenaire externe',
      duration: '8h a 16h',
      pricing: 'A definir',
      url: '',
    };
  }

  private buildFallbackRecommendations(): RecommendationItem[] {
    const sampleGap: GapStatisticsPayload = {
      competence_name: 'Pilotage KPI logistiques',
      metier_name: 'Gestionnaire de stocks',
      domaine_name: 'Supply Chain',
      competence_type: 'Technique',
      keywords: 'kpi, stock, reporting',
      pct_students: 72,
      n_gap: 18,
      n_students_total: 25,
    };

    return [
      {
        id: this.buildRecommendationId(1, 'pilotage-kpi-logistiques', 'gestionnaire-de-stocks'),
        category: 'Supply Chain',
        gapLabel: 'Technique',
        gapTitle: 'Pilotage KPI logistiques',
        level: 'HAUTE',
        metier: 'Gestionnaire de stocks',
        keywords: ['kpi', 'stock', 'reporting'],
        concernRate: 72,
        studentsImpacted: 18,
        totalStudents: 25,
        llmRecommendation: this.buildFallbackRecommendationText(
          {
            competenceName: this.toText(sampleGap.competence_name),
            metierName: this.toText(sampleGap.metier_name),
            concernRate: this.toNumber(sampleGap.pct_students),
            studentsImpacted: this.toNumber(sampleGap.n_gap),
            totalStudents: this.toNumber(sampleGap.n_students_total),
          },
          this.buildFallbackCertification(sampleGap),
        ),
        certification: this.buildFallbackCertification(sampleGap),
        status: this.overrides.get('rec-001')?.status ?? 'PENDING',
      },
    ];
  }

  private async qdrantScroll(
    collectionName: string,
    body: Record<string, unknown>,
  ): Promise<QdrantScrollResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.qdrantApiKey) {
      headers['api-key'] = this.qdrantApiKey;
    }

    try {
      const response = await fetch(
        `${this.qdrantUrl}/collections/${encodeURIComponent(collectionName)}/points/scroll`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(
          `Qdrant scroll ${collectionName} failed (${response.status}): ${text}`,
        );
        return { points: [], nextPageOffset: null };
      }

      const data = (await response.json()) as {
        result?: {
          points?: QdrantScrollPoint[];
          next_page_offset?: string | number | null;
        };
      };

      return {
        points: data.result?.points ?? [],
        nextPageOffset: data.result?.next_page_offset ?? null,
      };
    } catch (error) {
      this.logger.warn(`Qdrant scroll error (${collectionName}): ${String(error)}`);
      return { points: [], nextPageOffset: null };
    }
  }

  private buildRecommendationId(
    index: number,
    competenceName: string,
    metierName: string,
  ): string {
    const normalized = `${competenceName}-${metierName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 80);

    return `rec-${index + 1}-${normalized || 'gap'}`;
  }

  private resolveLevel(pctStudents: number): RecommendationLevel {
    if (pctStudents >= 80) return 'CRITIQUE';
    if (pctStudents >= 60) return 'HAUTE';
    return 'MOYENNE';
  }

  private resolveLevelsForGaps(gaps: GapStatisticsPayload[]): RecommendationLevel[] {
    if (gaps.length === 0) {
      return [];
    }

    const rates = gaps.map((gap) => this.toNumber(gap.pct_students));
    const maxRate = Math.max(...rates);
    const minRate = Math.min(...rates);
    const spread = maxRate - minRate;

    // When rates are naturally spread, keep business thresholds.
    if (spread >= 20) {
      return rates.map((rate) => this.resolveLevel(rate));
    }

    // If rates are tightly clustered (e.g. many 90-100%), use rank bands
    // to keep dashboard segmentation informative for admins.
    const criticalCount = Math.max(1, Math.floor(gaps.length * 0.3));
    const highCount = Math.max(1, Math.floor(gaps.length * 0.35));

    return gaps.map((_, index) => {
      if (index < criticalCount) {
        return 'CRITIQUE';
      }
      if (index < criticalCount + highCount) {
        return 'HAUTE';
      }
      return 'MOYENNE';
    });
  }

  private parseKeywords(rawKeywords: unknown): string[] {
    const text = this.toText(rawKeywords, '');
    if (!text) return [];

    return text
      .split(/[;,|]/)
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
      .slice(0, 8);
  }

  private parseStudentIds(rawValue: unknown): string[] {
    if (!Array.isArray(rawValue)) {
      return [];
    }

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return rawValue
      .map((value) => String(value ?? '').trim())
      .filter((value) => uuidPattern.test(value));
  }

  private normalizeLevel(value: unknown): RecommendationLevel {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized === 'CRITIQUE' || normalized === 'HAUTE') {
      return normalized;
    }
    return 'MOYENNE';
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3);
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private toText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) {
      return fallback;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : fallback;
  }

  private parseNumberEnv(
    key: string,
    fallback: number,
    allowZero = false,
  ): number {
    const rawValue = this.configService.get<string>(key);
    const parsed = Number(rawValue);
    if (Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0)) {
      return Math.floor(parsed);
    }

    return fallback;
  }
}
