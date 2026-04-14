import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabase } from '../config/supabase.client';
import { RefCompetanceService } from '../ref_competance/ref_competance.service';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

type AtsScoreResult = {
  matchScore: number;
  successScore: number;
  atsScore: number;
  rawResponse: string;
};

type ExtractedHardSkill = {
  type: string;
  nom: string;
  niveau: string;
  metierIds: string[];
};

type ExtractedSoftSkill = {
  nom: string;
  niveau: string;
  contexte: string;
};

type ExtractedSkillsResult = {
  hardSkills: ExtractedHardSkill[];
  softSkills: ExtractedSoftSkill[];
};

type ResolvedStudentNote = {
  codeEcue: string;
  moyenne: number;
};

type GeminiProviderConfig = {
  name: 'primary' | 'secondary';
  apiKey: string;
  model: string;
};

type MatchingTopSkill = {
  skill: string;
  score: number;
};

type MatchingMetierRankingEntry = {
  metier: string;
  domaine: string;
  nCompetences: number;
  matched: number;
  coveragePct: number;
  avgScore: number;
  topSkills: MatchingTopSkill[];
};

type MatchingGapEntry = {
  refCompetence: string;
  refMetier: string;
  refDomaine: string;
  refType: string;
  refMotsCles: string;
  bestCvSkill: string;
  bestCvNiveau: string;
  similarityScore: number;
  status: 'match' | 'gap';
};

type MatchingStudentSkillInput = {
  nom: string;
  niveau: string;
  type: string;
};

type MatchingReferenceCompetenceInput = {
  domaine: string;
  metier: string;
  competence: string;
  type_competence: string;
  mots_cles: string;
};

type MatchingAnalysisSummary = {
  nSkills: number;
  nMatches: number;
  nGaps: number;
  matchRatePct: number;
};

type MatchingAnalysisResult = {
  cvSubmissionId: string;
  selectedMetierId: string;
  generatedAt: string;
  modelName: string;
  threshold: number;
  summary: MatchingAnalysisSummary;
  topMetier: MatchingMetierRankingEntry | null;
  metierRanking: MatchingMetierRankingEntry[];
  matches: MatchingGapEntry[];
  gaps: MatchingGapEntry[];
  topMetierGaps: MatchingGapEntry[];
};

type MatchingCacheEntry = {
  fingerprint: string;
  result: MatchingAnalysisResult;
  cachedAt: string;
};

type LatestCvSubmissionMeta = {
  id: string;
  metierId: string;
  updatedAt: string;
};

type MatchingAnalysisTraceResult = {
  analysis: MatchingAnalysisResult;
  analysisId: string | null;
  analysisFingerprint: string;
  metierScores: any[];
  competenceResults: any[];
};

type EmployabilityComputationResult = {
  ok: boolean;
  studentId: string;
  scoreFinal: number | null;
  outputPath: string;
  error?: string;
};

@Injectable()
export class CvSubmissionService {
  private readonly logger = new Logger(CvSubmissionService.name);
  private readonly supabase = getSupabase();
  private readonly geminiPrimaryApiKey: string;
  private readonly geminiSecondaryApiKey: string;
  private readonly geminiPrimaryModel: string;
  private readonly geminiSecondaryModel: string;
  private readonly matchingPythonServiceUrl: string;
  private readonly matchingPythonTimeoutMs: number;
  private readonly employabilityPythonExecutable: string;
  private readonly employabilityScriptPath: string;
  private readonly employabilityXlsxPath: string;
  private readonly employabilityCsvPath: string;
  private readonly employabilityTimeoutMs: number;
  private readonly matchingThreshold: number;
  private readonly disabledGeminiProviders = new Set<string>();
  private readonly matchingAnalysisCache = new Map<string, MatchingCacheEntry>();
  private matchingTableMissingLogged = false;
  private matchingTraceTableMissingLogged = false;
  private static readonly DEFAULT_MATCHING_PYTHON_SERVICE_URL = 'http://127.0.0.1:8001';
  private static readonly DEFAULT_EMPLOYABILITY_TIMEOUT_MS = 120_000;
  private static readonly MATCHING_ANALYSIS_VERSION = 'v4-traceable-persistence';
  private static readonly MAX_MATCHING_GAPS = 5000;
  private static readonly AUTO_SKILL_CONTEXT = '__auto_generated_from_notes__';

  constructor(
    private readonly configService: ConfigService,
    private readonly refCompetanceService: RefCompetanceService,
  ) {
    this.geminiPrimaryApiKey =
      this.configService.get<string>('GEMINI_API_KEY_PRIMARY')
      ?? this.configService.get<string>('GEMINI_API_KEY')
      ?? '';

    this.geminiSecondaryApiKey =
      this.configService.get<string>('GEMINI_API_KEY_SECONDARY')
      ?? '';

    this.geminiPrimaryModel =
      this.configService.get<string>('GEMINI_MODEL_PRIMARY')
      ?? 'gemini-3.1-flash-lite-preview';

    this.geminiSecondaryModel =
      this.configService.get<string>('GEMINI_MODEL_SECONDARY')
      ?? 'gemini-2.5-flash-lite';

    this.matchingPythonServiceUrl = (
      this.configService.get<string>('MATCHING_PYTHON_SERVICE_URL')
      ?? CvSubmissionService.DEFAULT_MATCHING_PYTHON_SERVICE_URL
    ).replace(/\/+$/, '');

    const configuredTimeoutMs = Number(
      this.configService.get<string>('MATCHING_PYTHON_TIMEOUT_MS') ?? '120000',
    );
    this.matchingPythonTimeoutMs = Number.isFinite(configuredTimeoutMs)
      ? Math.max(10_000, Math.floor(configuredTimeoutMs))
      : 120_000;

    const configuredThreshold = Number(
      this.configService.get<string>('MATCHING_MODEL_THRESHOLD') ?? '0.72',
    );
    this.matchingThreshold = Number.isFinite(configuredThreshold)
      ? Math.max(0, Math.min(1, configuredThreshold))
      : 0.72;

    this.employabilityPythonExecutable =
      this.configService.get<string>('EMPLOYABILITY_PYTHON_EXECUTABLE')
      ?? this.configService.get<string>('PYTHON_EXECUTABLE')
      ?? 'python';

    const backendCwd = process.cwd();
    const repoRootGuess = resolve(backendCwd, '..');

    this.employabilityScriptPath =
      this.configService.get<string>('EMPLOYABILITY_SCORE_SCRIPT_PATH')
      ?? resolve(repoRootGuess, 'employabilite_service', 'score.py');

    this.employabilityXlsxPath =
      this.configService.get<string>('EMPLOYABILITY_MATRIX_XLSX_PATH')
      ?? resolve(repoRootGuess, 'employabilite_service', 'matrice_coverture.xlsx');

    this.employabilityCsvPath =
      this.configService.get<string>('EMPLOYABILITY_OUTPUT_CSV_PATH')
      ?? resolve(repoRootGuess, 'employabilite_service', 'logilink_scores.csv');

    const configuredEmployabilityTimeout = Number(
      this.configService.get<string>('EMPLOYABILITY_TIMEOUT_MS')
      ?? String(CvSubmissionService.DEFAULT_EMPLOYABILITY_TIMEOUT_MS),
    );
    this.employabilityTimeoutMs = Number.isFinite(configuredEmployabilityTimeout)
      ? Math.max(10_000, Math.floor(configuredEmployabilityTimeout))
      : CvSubmissionService.DEFAULT_EMPLOYABILITY_TIMEOUT_MS;
  }

  private async resolveStudentIdByAuthId(authId: string): Promise<string | null> {
    const { data: userRow, error } = await this.supabase
      .from('user')
      .select('id')
      .eq('auth_id', authId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!userRow || userRow.id === undefined || userRow.id === null) {
      return null;
    }

    return String(userRow.id).trim() || null;
  }

  private parseEmployabilityResult(stdout: string): EmployabilityComputationResult | null {
    const marker = 'RESULT_JSON:';
    const line = stdout
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(marker));

    if (!line) return null;

    const rawJson = line.slice(marker.length);
    try {
      const parsed = JSON.parse(rawJson) as Record<string, any>;
      return {
        ok: Boolean(parsed?.ok),
        studentId: String(parsed?.studentId ?? '').trim(),
        scoreFinal: parsed?.scoreFinal === null || parsed?.scoreFinal === undefined
          ? null
          : Number(parsed?.scoreFinal),
        outputPath: String(parsed?.outputPath ?? this.employabilityCsvPath),
        error: parsed?.error ? String(parsed.error) : undefined,
      };
    } catch {
      return null;
    }
  }

  async runEmployabilityScoringForAuthId(authId: string): Promise<EmployabilityComputationResult> {
    const studentId = await this.resolveStudentIdByAuthId(authId);
    if (!studentId) {
      return {
        ok: false,
        studentId: '',
        scoreFinal: null,
        outputPath: this.employabilityCsvPath,
        error: 'Student not found for current authenticated user.',
      };
    }

    if (!existsSync(this.employabilityScriptPath)) {
      return {
        ok: false,
        studentId,
        scoreFinal: null,
        outputPath: this.employabilityCsvPath,
        error: `Employability script not found at ${this.employabilityScriptPath}`,
      };
    }

    if (!existsSync(this.employabilityXlsxPath)) {
      return {
        ok: false,
        studentId,
        scoreFinal: null,
        outputPath: this.employabilityCsvPath,
        error: `Employability matrix file not found at ${this.employabilityXlsxPath}`,
      };
    }

    return await new Promise<EmployabilityComputationResult>((resolvePromise, rejectPromise) => {
      const args = [
        this.employabilityScriptPath,
        '--student-id',
        studentId,
        '--xlsx-path',
        this.employabilityXlsxPath,
        '--output-path',
        this.employabilityCsvPath,
        '--json',
      ];

      const child = spawn(this.employabilityPythonExecutable, args, {
        cwd: process.cwd(),
        env: process.env,
        windowsHide: true,
      });

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        child.kill();
        rejectPromise(
          new Error(`Employability scoring timed out after ${this.employabilityTimeoutMs}ms`),
        );
      }, this.employabilityTimeoutMs);

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        rejectPromise(err);
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        const parsed = this.parseEmployabilityResult(stdout);

        if (code !== 0) {
          const details = stderr.trim() || stdout.trim() || `exit code ${code}`;
          rejectPromise(new Error(`Employability scoring process failed: ${details}`));
          return;
        }

        if (parsed) {
          resolvePromise(parsed);
          return;
        }

        resolvePromise({
          ok: true,
          studentId,
          scoreFinal: null,
          outputPath: this.employabilityCsvPath,
        });
      });
    });
  }

  private sanitizeDate(value: any): string | null {
    if (!value && value !== 0) return null;
    const v = String(value).trim();
    if (v === '') return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }

  async upsertCv(authId: string, payload: any): Promise<void> {
    // Upsert main row using auth_id as unique key
    const { data: mainRow, error: mainError } = await this.supabase
      .from('cv_submissions')
      .upsert([
        {
          auth_id: authId,
          metier_id: this.normalizeMetierId(payload?.metierId) || null,
          professional_title: payload.professionalTitle,
          specialization: payload.specialization,
          objectif: payload.objectif,
          permis: payload.info?.permis,
          linkedin: payload.info?.linkedin,
          date_naissance: this.sanitizeDate(payload.info?.dateNaissance),
          photo_url: payload.info?.photoUrl,
          ats_score: payload.atsScore,
          consent_given: payload.consentGiven,
          consent_at: payload.consentGiven ? new Date().toISOString() : null,
          status: 'draft',
          updated_at: new Date().toISOString(),
        },
      ], { onConflict: 'auth_id' })
      .select('id')
      .single();

    if (mainError) throw mainError;
    const cvSubmissionId = mainRow.id;

    const childTables = [
      'cv_formations',
      'cv_experiences',
      'cv_langues',
      'cv_projets',
      'cv_certifications',
      'cv_engagements',
    ];

    for (const table of childTables) {
      await this.supabase.from(table).delete().eq('cv_submission_id', cvSubmissionId);
    }

    // Insert formations with explicit column mapping
    if (payload.formations?.length) {
      const formationsRows = payload.formations.map((f: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        diplome: f.diplome ?? f.diploma ?? null,
        institution: f.institution ?? null,
        date_debut: this.sanitizeDate(f.dateDebut ?? f.date_debut ?? f.startDate),
        date_fin: this.sanitizeDate(f.dateFin ?? f.date_fin ?? f.endDate),
        moyenne: f.moyenne ?? null,
        modules: f.modules ?? null,
        pfe_titre: f.pfeTitre ?? f.pfe_titre ?? null,
        pfe_entreprise: f.pfeEntreprise ?? f.pfe_entreprise ?? null,
        pfe_technologies: f.pfeTechnologies ?? f.pfe_technologies ?? null,
      }));
      const { error: fErr } = await this.supabase.from('cv_formations').insert(formationsRows);
      if (fErr) {
        console.error('[cv-submissions] cv_formations insert error', fErr);
        throw fErr;
      }
    }

    // Experiences
    if (payload.experiences?.length) {
      const expRows = payload.experiences.map((e: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        poste: e.poste ?? null,
        entreprise: e.entreprise ?? null,
        secteur: e.secteur ?? null,
        date_debut: this.sanitizeDate(e.dateDebut ?? e.date_debut ?? e.startDate),
        date_fin: this.sanitizeDate(e.dateFin ?? e.date_fin ?? e.endDate),
        lieu: e.lieu ?? null,
        description: e.description ?? null,
        mots_cles: e.motsCles ?? e.mots_cles ?? null,
      }));
      const { error: eErr } = await this.supabase.from('cv_experiences').insert(expRows);
      if (eErr) {
        console.error('[cv-submissions] cv_experiences insert error', eErr);
        throw eErr;
      }
    }

    await this.upsertCvSkills(authId, cvSubmissionId, payload);

    // Langues
    if (payload.langues?.length) {
      const langs = payload.langues.map((l: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        langue: l.langue ?? null,
        niveau_cecrl: l.niveau ?? l.niveau_cecrl ?? null,
        certification: l.certification ?? null,
        score: l.score ?? null,
      }));
      const { error: lgErr } = await this.supabase.from('cv_langues').insert(langs);
      if (lgErr) {
        console.error('[cv-submissions] cv_langues insert error', lgErr);
        throw lgErr;
      }
    }

    // Projets
    if (payload.projets?.length) {
      const projRows = payload.projets.map((p: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        titre: p.titre ?? null,
        description: p.description ?? null,
        technologies: p.technologies ?? null,
        lien: p.lien ?? null,
      }));
      const { error: pjErr } = await this.supabase.from('cv_projets').insert(projRows);
      if (pjErr) {
        console.error('[cv-submissions] cv_projets insert error', pjErr);
        throw pjErr;
      }
    }

    // Certifications
    if (payload.certifications?.length) {
      const certRows = payload.certifications.map((c: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        titre: c.titre ?? null,
        organisme: c.organisme ?? null,
        date_obtenue: this.sanitizeDate(c.date_obtenue ?? c.dateObtenue ?? c.date),
        verification: c.verification ?? null,
      }));
      const { error: cErr } = await this.supabase.from('cv_certifications').insert(certRows);
      if (cErr) {
        console.error('[cv-submissions] cv_certifications insert error', cErr);
        throw cErr;
      }
    }

    // Engagements
    if (payload.engagements?.length) {
      const engRows = payload.engagements.map((e: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        type: e.type ?? null,
        role: e.role ?? null,
        date_debut: this.sanitizeDate(e.dateDebut ?? e.date_debut ?? e.startDate),
        date_fin: this.sanitizeDate(e.dateFin ?? e.date_fin ?? e.endDate),
      }));
      const { error: enErr } = await this.supabase.from('cv_engagements').insert(engRows);
      if (enErr) {
        console.error('[cv-submissions] cv_engagements insert error', enErr);
        throw enErr;
      }
    }
  }

  private normalizeSkillKey(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeSkillLevel(value: unknown): string {
    const normalized = this.normalizeSkillKey(value);
    if (!normalized) return 'Intermediaire';
    if (normalized.includes('expert')) return 'Expert';
    if (normalized.includes('avance')) return 'Avance';
    if (normalized.includes('intermediaire')) return 'Intermediaire';
    if (normalized.includes('notion')) return 'Notions';
    if (
      normalized.includes('debutant')
      || normalized.includes('faible')
      || normalized.includes('non acquis')
      || normalized === 'non_acquis'
    ) {
      return 'Debutant';
    }
    return 'Intermediaire';
  }

  private skillLevelPriority(level: unknown): number {
    const normalized = this.normalizeSkillLevel(level);
    const order: Record<string, number> = {
      Debutant: 1,
      Notions: 2,
      Intermediaire: 3,
      Avance: 4,
      Expert: 5,
    };
    return order[normalized] ?? 0;
  }

  private matchingNiveauWeight(level: unknown): number {
    const normalized = this.normalizeSkillLevel(level);
    if (normalized === 'Avance' || normalized === 'Expert') return 1.0;
    if (normalized === 'Debutant' || normalized === 'Notions') return 0.2;
    if (normalized === 'Intermediaire') return 0.5;
    return 0.5;
  }

  private dedupeSkillList<T extends { nom: string; niveau: string; metierIds?: string[] }>(skills: T[]): T[] {
    const byName = new Map<string, T>();
    for (const item of skills) {
      const nom = String(item.nom ?? '').trim();
      if (!nom) continue;

      const key = this.normalizeSkillKey(nom);
      const normalizedMetierIds = this.parseMetierIds((item as any).metierIds);
      const normalizedItem = {
        ...item,
        nom,
        niveau: this.normalizeSkillLevel(item.niveau),
        ...(normalizedMetierIds.length > 0 ? { metierIds: normalizedMetierIds } : {}),
      } as T;
      const existing = byName.get(key);
      if (!existing) {
        byName.set(key, normalizedItem);
        continue;
      }

      const existingMetierIds = this.parseMetierIds((existing as any).metierIds);
      const mergedMetierIds = [...new Set([...existingMetierIds, ...normalizedMetierIds])];
      const keepNew = this.skillLevelPriority(normalizedItem.niveau) > this.skillLevelPriority(existing.niveau);
      const winner = keepNew ? normalizedItem : existing;

      byName.set(key, {
        ...winner,
        ...(mergedMetierIds.length > 0 ? { metierIds: mergedMetierIds } : {}),
      } as T);
    }
    return Array.from(byName.values());
  }

  private normalizeIncomingHardSkills(skills: any[] | undefined): Array<{
    type: string;
    nom: string;
    niveau: string;
    contexte: string | null;
    metierIds: string[];
  }> {
    if (!Array.isArray(skills)) return [];
    return skills
      .map((s) => ({
        type: String(s?.type ?? s?.skill_type ?? 'Metier T&L').trim() || 'Metier T&L',
        nom: String(s?.nom ?? s?.name ?? '').trim(),
        niveau: this.normalizeSkillLevel(s?.niveau),
        contexte: s?.contexte ? String(s.contexte) : null,
        metierIds: this.parseMetierIds(s?.metierIds ?? s?.metier_ids),
      }))
      .filter((s) => s.nom.length > 0);
  }

  private normalizeIncomingSoftSkills(skills: any[] | undefined): Array<{
    nom: string;
    niveau: string;
    contexte: string | null;
  }> {
    if (!Array.isArray(skills)) return [];
    return skills
      .map((s) => ({
        nom: String(s?.nom ?? s?.name ?? '').trim(),
        niveau: this.normalizeSkillLevel(s?.niveau),
        contexte: s?.contexte ? String(s.contexte) : (s?.context ? String(s.context) : null),
      }))
      .filter((s) => s.nom.length > 0);
  }

  private async upsertCvSkills(
    authId: string,
    cvSubmissionId: string,
    payload: any,
  ): Promise<void> {
    const { data: existingSkills, error: existingSkillsErr } = await this.supabase
      .from('cv_skills')
      .select('id, category, skill_type, nom, niveau, contexte, sort_order')
      .eq('cv_submission_id', cvSubmissionId)
      .order('sort_order', { ascending: true });

    if (existingSkillsErr) throw existingSkillsErr;

    const existingRows = Array.isArray(existingSkills) ? existingSkills : [];
    const existingSystemHardRows = existingRows
      .filter((s: any) => s.category === 'hard' && s.contexte === CvSubmissionService.AUTO_SKILL_CONTEXT);

    const existingSystemHardIds = existingSystemHardRows
      .map((s: any) => String(s.id ?? '').trim())
      .filter((id) => id.length > 0);

    const existingMetiersBySkillId = new Map<string, string[]>();
    if (existingSystemHardIds.length > 0) {
      try {
        const { data: existingLinks, error: existingLinksErr } = await this.supabase
          .from('cv_skill_metiers')
          .select('cv_skill_id, metier_id')
          .in('cv_skill_id', existingSystemHardIds);

        if (existingLinksErr) {
          const message = String(existingLinksErr?.message ?? '').toLowerCase();
          if (!message.includes('cv_skill_metiers')) {
            throw existingLinksErr;
          }
          this.logger.warn('cv_skill_metiers table not available yet; hard-skill metier links cannot be restored.');
        } else if (Array.isArray(existingLinks)) {
          for (const link of existingLinks as any[]) {
            const skillId = String(link?.cv_skill_id ?? '').trim();
            const metierId = this.normalizeMetierId(link?.metier_id);
            if (!skillId || !metierId) continue;

            const current = existingMetiersBySkillId.get(skillId) ?? [];
            if (!current.includes(metierId)) {
              current.push(metierId);
              existingMetiersBySkillId.set(skillId, current);
            }
          }
        }
      } catch (err: any) {
        this.logger.warn(`Failed to load existing skill-metier links: ${err?.message ?? err}`);
      }
    }

    const systemHardExisting = existingSystemHardRows
      .map((s: any) => {
        const skillId = String(s.id ?? '').trim();
        return {
          type: String(s.skill_type ?? 'Metier T&L').trim() || 'Metier T&L',
          nom: String(s.nom ?? '').trim(),
          niveau: this.normalizeSkillLevel(s.niveau),
          contexte: CvSubmissionService.AUTO_SKILL_CONTEXT,
          metierIds: existingMetiersBySkillId.get(skillId) ?? [],
        };
      })
      .filter((s) => s.nom.length > 0);

    const extractedInventory = await this.extractAllHardSkillsFromNotes(authId);

    const extractedHard = extractedInventory.map((s) => ({
      type: String(s.type ?? 'Metier T&L').trim() || 'Metier T&L',
      nom: String(s.nom ?? '').trim(),
      niveau: this.normalizeSkillLevel(s.niveau),
      contexte: CvSubmissionService.AUTO_SKILL_CONTEXT,
      metierIds: this.parseMetierIds(s.metierIds),
    })).filter((s) => s.nom.length > 0);

    const incomingHard = this.dedupeSkillList(this.normalizeIncomingHardSkills(payload?.hardSkills));
    const incomingSoft = this.dedupeSkillList(this.normalizeIncomingSoftSkills(payload?.softSkills));

    const selectedMetierId = this.normalizeMetierId(payload?.metierId);
    let allowIncomingHard = true;
    if (selectedMetierId) {
      const metierHardSkills = await this.buildHardSkillsFromNotes(authId, selectedMetierId);
      allowIncomingHard = metierHardSkills.length > 0;

      if (!allowIncomingHard && incomingHard.length > 0) {
        this.logger.warn(
          `Ignoring manual hard skills for auth_id=${authId} because metier=${selectedMetierId} has no extracted hard skills.`,
        );
      }
    }

    const lockedHard = this.dedupeSkillList(
      extractedHard.length > 0
        ? extractedHard
        : (systemHardExisting.length > 0 ? systemHardExisting : []),
    );

    const finalHard = this.dedupeSkillList(
      lockedHard.length > 0 ? lockedHard : (allowIncomingHard ? incomingHard : []),
    );
    const finalSoft = this.dedupeSkillList(incomingSoft);

    const hardRowsWithMetiers = finalHard.map((s, index) => ({
      row: {
        cv_submission_id: cvSubmissionId,
        sort_order: index,
        category: 'hard',
        skill_type: s.type,
        nom: s.nom,
        niveau: s.niveau,
        contexte: s.contexte ?? null,
      },
      metierIds: this.parseMetierIds((s as any).metierIds),
    }));

    const softRows = finalSoft.map((s, index) => ({
      cv_submission_id: cvSubmissionId,
      sort_order: hardRowsWithMetiers.length + index,
      category: 'soft',
      skill_type: null,
      nom: s.nom,
      niveau: s.niveau,
      contexte: s.contexte ?? null,
    }));

    const rowsToInsert = [
      ...hardRowsWithMetiers.map((entry) => entry.row),
      ...softRows,
    ];

    const { error: deleteErr } = await this.supabase
      .from('cv_skills')
      .delete()
      .eq('cv_submission_id', cvSubmissionId);
    if (deleteErr) throw deleteErr;

    if (!rowsToInsert.length) {
      return;
    }

    const { data: insertedSkills, error: skErr } = await this.supabase
      .from('cv_skills')
      .insert(rowsToInsert)
      .select('id, category, sort_order');
    if (skErr) {
      console.error('[cv-submissions] cv_skills insert error', skErr);
      throw skErr;
    }

    const hardMetierRows: Array<{ cv_skill_id: string; metier_id: string }> = [];
    if (Array.isArray(insertedSkills)) {
      const metiersBySortOrder = new Map<number, string[]>(
        hardRowsWithMetiers.map((entry) => [entry.row.sort_order, entry.metierIds]),
      );

      for (const inserted of insertedSkills as any[]) {
        if (inserted?.category !== 'hard') continue;

        const skillId = String(inserted?.id ?? '').trim();
        const sortOrder = Number(inserted?.sort_order);
        if (!skillId || !Number.isFinite(sortOrder)) continue;

        const metierIds = metiersBySortOrder.get(sortOrder) ?? [];
        for (const metierId of metierIds) {
          if (!metierId) continue;
          hardMetierRows.push({
            cv_skill_id: skillId,
            metier_id: metierId,
          });
        }
      }
    }

    if (!hardMetierRows.length) {
      return;
    }

    try {
      const { error: linkErr } = await this.supabase
        .from('cv_skill_metiers')
        .insert(hardMetierRows);
      if (linkErr) {
        const message = String(linkErr?.message ?? '').toLowerCase();
        if (!message.includes('cv_skill_metiers')) {
          throw linkErr;
        }
        this.logger.warn('cv_skill_metiers table not available yet; hard-skill metier links were not persisted.');
      }
    } catch (err: any) {
      this.logger.warn(`Failed to persist skill-metier links: ${err?.message ?? err}`);
    }
  }

  private splitPipeValues(value: unknown): string[] {
    if (typeof value !== 'string') return [];
    return value
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }

  private normalizeMetierId(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
  }

  private parseMetierIds(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.normalizeMetierId(entry))
        .filter((entry) => entry.length > 0);
    }

    if (typeof value !== 'string') {
      return [];
    }

    const raw = value.trim();
    if (!raw) {
      return [];
    }

    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        return this.parseMetierIds(parsed);
      } catch {
        // Fall through to delimiter-based parsing.
      }
    }

    return raw
      .split(/[|,;]+/)
      .map((part) => this.normalizeMetierId(part))
      .filter((part) => part.length > 0);
  }

  private toBooleanFlag(value: unknown): boolean {
    if (value === true || value === 1 || value === '1') return true;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === 'true' || normalized === 'yes' || normalized === 'oui';
    }
    return false;
  }

  private predictLevelFromMoyenne(moyenne: number, isHard: boolean): string {
    if (moyenne < 10) return 'Debutant';
    if (moyenne < 12) return 'Debutant';
    if (moyenne < 15) {
      if (isHard && moyenne >= 13) return 'Avance';
      return 'Intermediaire';
    }
    return 'Avance';
  }

  private classifySkillCategory(compType: string, isHardSkill: unknown): 'hard' | 'soft' {
    const normalized = this.normalizeSkillKey(compType);
    if (normalized.includes('comportement')) return 'soft';
    if (normalized.includes('organisation')) return 'soft';
    if (normalized.includes('soft')) return 'soft';

    if (!normalized && !this.toBooleanFlag(isHardSkill)) {
      return 'soft';
    }

    return 'hard';
  }

  private classifyHardSkillType(competence: string, compType: string): string {
    const normalized = this.normalizeSkillKey(`${competence} ${compType}`);

    if (
      ['sap', 'erp', 'wms', 'tms', 'excel', 'vba', 'sql', 'iot', 'scanner', 'pda', 'si', 'data']
        .some((hint) => normalized.includes(hint))
    ) {
      return 'Outil / Logiciel';
    }

    if (
      ['lean', 'kaizen', 'fifo', 's op', 'sop', 'method']
        .some((hint) => normalized.includes(hint))
    ) {
      return 'Methodologie';
    }

    if (
      ['iso', 'rse', 'cmr', 'incoterm', 'oea', 'douane', 'reglement', 'audit', 'delta']
        .some((hint) => normalized.includes(hint))
    ) {
      return 'Norme / Reglement';
    }

    return 'Metier T&L';
  }

  private async loadStudentNotes(studentId: number): Promise<ResolvedStudentNote[]> {
    const attempts: Array<{
      select: string;
      idColumn: string;
      moyenneColumn: string;
    }> = [
      {
        select: 'student_id, code_ecue, moyenne',
        idColumn: 'student_id',
        moyenneColumn: 'moyenne',
      },
      {
        select: 'etudiant, code_ecue, moyenne_matiere',
        idColumn: 'etudiant',
        moyenneColumn: 'moyenne_matiere',
      },
    ];

    let lastError: any = null;

    for (const attempt of attempts) {
      const { data, error } = await this.supabase
        .from('note')
        .select(attempt.select)
        .eq(attempt.idColumn, studentId);

      if (error) {
        lastError = error;
        continue;
      }

      const rows = Array.isArray(data) ? data : [];
      if (!rows.length) {
        continue;
      }

      return rows
        .map((row: any) => {
          const moyenne = Number(row?.[attempt.moyenneColumn]);
          return {
            codeEcue: String(row?.code_ecue ?? '').trim(),
            moyenne,
          };
        })
        .filter((row) => row.codeEcue.length > 0 && Number.isFinite(row.moyenne));
    }

    if (lastError) {
      this.logger.warn(`extractSkillsFromNotes: failed note query for student_id=${studentId}: ${lastError?.message ?? lastError}`);
    }

    return [];
  }

  private async loadMatiereCompetenceLookup(codeEcues: string[], metierId?: string): Promise<Map<string, any>> {
    if (!codeEcues.length) return new Map<string, any>();

    const normalizedMetierId = this.normalizeMetierId(metierId);

    const attempts = [
      'code_ecue, competences, comp_types, is_hard, is_hard_skill, metier_ids',
      'code_ecue, competences, is_hard, is_hard_skill, metier_ids',
      'code_ecue, competences, is_hard, metier_ids',
    ];

    let lastError: any = null;

    for (const select of attempts) {
      const { data, error } = await this.supabase
        .from('matiere_competence')
        .select(select)
        .in('code_ecue', codeEcues);

      if (error) {
        lastError = error;
        continue;
      }

      const rows = Array.isArray(data) ? data : [];
      const lookup = new Map<string, any>();
      for (const row of rows as any[]) {
        const key = String(row?.code_ecue ?? '').trim();
        if (!key) continue;

        if (normalizedMetierId) {
          const linkedMetiers = this.parseMetierIds(row?.metier_ids);
          if (!linkedMetiers.includes(normalizedMetierId)) {
            continue;
          }
        }

        lookup.set(key, row);
      }
      return lookup;
    }

    if (lastError) {
      this.logger.warn(`extractSkillsFromNotes: failed matiere_competence query: ${lastError?.message ?? lastError}`);
    }

    return new Map<string, any>();
  }

  private async buildHardSkillsFromNotes(authId: string, metierId?: string): Promise<ExtractedHardSkill[]> {
    const normalizedMetierId = this.normalizeMetierId(metierId);

    const { data: userRow, error: userErr } = await this.supabase
      .from('user')
      .select('id')
      .eq('auth_id', authId)
      .maybeSingle();

    if (userErr || !userRow) {
      this.logger.warn(`extractSkillsFromNotes: no user found for auth_id=${authId}`);
      return [];
    }

    const studentId = Number(userRow.id);
    if (!Number.isFinite(studentId)) {
      this.logger.warn(`extractSkillsFromNotes: invalid student id for auth_id=${authId}`);
      return [];
    }

    const notes = await this.loadStudentNotes(studentId);
    if (!notes.length) {
      this.logger.warn(`extractSkillsFromNotes: no notes for student_id=${studentId}`);
      return [];
    }

    const codeEcues = [...new Set(notes.map((note) => note.codeEcue).filter(Boolean))];
    const matiereLookup = await this.loadMatiereCompetenceLookup(codeEcues, normalizedMetierId);
    if (!matiereLookup.size) {
      this.logger.warn(`extractSkillsFromNotes: no matiere_competence rows for student_id=${studentId}`);
      return [];
    }

    const hardMap = new Map<string, ExtractedHardSkill & { priority: number }>();

    for (const note of notes) {
      const matiere = matiereLookup.get(note.codeEcue);
      if (!matiere) continue;

      const competences = this.splitPipeValues(matiere?.competences);
      if (!competences.length) continue;

      const compTypes = this.splitPipeValues(matiere?.comp_types);
      const rowMetierIds = this.parseMetierIds(matiere?.metier_ids);
      const isHardMatiere = this.toBooleanFlag(matiere?.is_hard);
      const predictedLevel = this.predictLevelFromMoyenne(note.moyenne, isHardMatiere);
      const levelPriority = this.skillLevelPriority(predictedLevel);

      for (let i = 0; i < competences.length; i += 1) {
        const competence = String(competences[i] ?? '').trim();
        if (!competence) continue;

        const compType = String(compTypes[i] ?? compTypes[0] ?? '').trim();
        const category = this.classifySkillCategory(compType, matiere?.is_hard_skill);
        const key = this.normalizeSkillKey(competence);
        if (!key) continue;

        if (category === 'hard') {
          const next: ExtractedHardSkill & { priority: number } = {
            type: this.classifyHardSkillType(competence, compType),
            nom: competence,
            niveau: predictedLevel,
            metierIds: rowMetierIds,
            priority: levelPriority,
          };
          const existing = hardMap.get(key);
          if (!existing) {
            hardMap.set(key, next);
            continue;
          }

          const mergedMetierIds = [...new Set([...(existing.metierIds ?? []), ...rowMetierIds])];
          if (next.priority > existing.priority) {
            hardMap.set(key, {
              ...next,
              metierIds: mergedMetierIds,
            });
          } else {
            hardMap.set(key, {
              ...existing,
              metierIds: mergedMetierIds,
            });
          }
          continue;
        }

        // Soft skills are intentionally not auto-filled from notes.
      }
    }

    const hardSkills = Array.from(hardMap.values())
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.nom.localeCompare(b.nom, 'fr');
      })
      .map(({ priority: _priority, ...skill }) => ({
        ...skill,
        metierIds: this.parseMetierIds(skill.metierIds),
      }));

    return hardSkills;
  }

  private async extractAllHardSkillsFromNotes(authId: string): Promise<ExtractedHardSkill[]> {
    return this.buildHardSkillsFromNotes(authId);
  }

  async extractSkillsFromNotes(authId: string, metierId?: string): Promise<ExtractedSkillsResult> {
    const emptyResult: ExtractedSkillsResult = { hardSkills: [], softSkills: [] };
    const normalizedMetierId = this.normalizeMetierId(metierId);

    if (!normalizedMetierId) {
      this.logger.log('extractSkillsFromNotes: metierId is required, skipping generation.');
      return emptyResult;
    }

    const hardSkills = await this.buildHardSkillsFromNotes(authId, normalizedMetierId);

    return { hardSkills, softSkills: [] };
  }

  async getCvByAuthId(authId: string, metierId?: string): Promise<any | null> {
    const supabase = this.supabase;

    const { data: mainRows, error: mainErr } = await supabase
      .from('cv_submissions')
      .select('*')
      .eq('auth_id', authId)
      .limit(1);
    if (mainErr) throw mainErr;
    const main = Array.isArray(mainRows) && mainRows.length > 0 ? mainRows[0] : null;
    if (!main) return null;

    const cvSubmissionId = main.id;

    const childTables = {
      formations: 'cv_formations',
      experiences: 'cv_experiences',
      skills: 'cv_skills',
      langues: 'cv_langues',
      projets: 'cv_projets',
      certifications: 'cv_certifications',
      engagements: 'cv_engagements',
    } as Record<string, string>;

    const result: any = {
      professionalTitle: main.professional_title,
      metierId: main.metier_id,
      specialization: main.specialization,
      objectif: main.objectif,
      info: {
        permis: main.permis,
        linkedin: main.linkedin,
        dateNaissance: main.date_naissance,
        photoUrl: main.photo_url,
      },
      atsScore: main.ats_score,
      consentGiven: main.consent_given,
      createdAt: main.created_at,
      updatedAt: main.updated_at,
      formations: [],
      experiences: [],
      hardSkills: [],
      softSkills: [],
      langues: [],
      projets: [],
      certifications: [],
      engagements: [],
    };

    for (const [key, table] of Object.entries(childTables)) {
      const { data, error } = await supabase.from(table).select('*').eq('cv_submission_id', cvSubmissionId).order('sort_order', { ascending: true });
      if (error) throw error;
      if (!data) continue;
      switch (key) {
        case 'formations': result.formations = data; break;
        case 'experiences': result.experiences = data; break;
        case 'skills': {
          const allHardSkills = data.filter((s: any) => s.category === 'hard');
          const selectedMetierId = this.normalizeMetierId(metierId || main.metier_id);
          let filteredHardSkills = allHardSkills;

          if (selectedMetierId && allHardSkills.length > 0) {
            const hardSkillIds = allHardSkills
              .map((s: any) => String(s?.id ?? '').trim())
              .filter((id: string) => id.length > 0);

            if (hardSkillIds.length > 0) {
              try {
                const { data: links, error: linksErr } = await supabase
                  .from('cv_skill_metiers')
                  .select('cv_skill_id, metier_id')
                  .in('cv_skill_id', hardSkillIds);

                if (linksErr) {
                  const message = String(linksErr?.message ?? '').toLowerCase();
                  if (!message.includes('cv_skill_metiers')) {
                    throw linksErr;
                  }
                  this.logger.warn('cv_skill_metiers table not available yet; returning unfiltered hard skills.');
                } else if (Array.isArray(links)) {
                  const metiersBySkillId = new Map<string, Set<string>>();

                  for (const link of links as any[]) {
                    const skillId = String(link?.cv_skill_id ?? '').trim();
                    const linkedMetierId = this.normalizeMetierId(link?.metier_id);
                    if (!skillId || !linkedMetierId) continue;

                    const set = metiersBySkillId.get(skillId) ?? new Set<string>();
                    set.add(linkedMetierId);
                    metiersBySkillId.set(skillId, set);
                  }

                  filteredHardSkills = allHardSkills.filter((skill: any) => {
                    const skillId = String(skill?.id ?? '').trim();
                    if (!skillId) return true;

                    const linkedMetiers = metiersBySkillId.get(skillId);
                    if (!linkedMetiers || linkedMetiers.size === 0) {
                      return true;
                    }

                    return linkedMetiers.has(selectedMetierId);
                  });
                }
              } catch (err: any) {
                this.logger.warn(`Failed to filter hard skills by metier: ${err?.message ?? err}`);
              }
            }
          }

          result.hardSkills = filteredHardSkills;
          result.allHardSkills = allHardSkills;
          result.softSkills = data.filter((s: any) => s.category === 'soft');
          break;
        }
        case 'langues': result.langues = data; break;
        case 'projets': result.projets = data; break;
        case 'certifications': result.certifications = data; break;
        case 'engagements': result.engagements = data; break;
      }
    }

    return result;
  }

  async getAtsScoreByAuthId(authId: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from('cv_submissions')
      .select('ats_score')
      .eq('auth_id', authId)
      .limit(1);

    if (error) throw error;
    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row || row.ats_score === undefined || row.ats_score === null) {
      return null;
    }

    return this.clampScore(Number(row.ats_score));
  }

  async updateAtsScore(authId: string, atsScore: number): Promise<void> {
    const safeScore = this.clampScore(atsScore);
    const now = new Date().toISOString();

    const { data: existing, error: existingErr } = await this.supabase
      .from('cv_submissions')
      .select('id')
      .eq('auth_id', authId)
      .limit(1);

    if (existingErr) throw existingErr;

    if (Array.isArray(existing) && existing.length > 0) {
      const { error: updateErr } = await this.supabase
        .from('cv_submissions')
        .update({ ats_score: safeScore, updated_at: now })
        .eq('auth_id', authId);
      if (updateErr) throw updateErr;
      return;
    }

    const { error: insertErr } = await this.supabase
      .from('cv_submissions')
      .insert([
        {
          auth_id: authId,
          ats_score: safeScore,
          status: 'draft',
          updated_at: now,
        },
      ]);

    if (insertErr) throw insertErr;
  }

  private createEmptyMatchingAnalysisResult(
    cvSubmissionId = '',
    selectedMetierId = '',
  ): MatchingAnalysisResult {
    return {
      cvSubmissionId,
      selectedMetierId,
      generatedAt: new Date().toISOString(),
      modelName: '',
      threshold: this.matchingThreshold,
      summary: {
        nSkills: 0,
        nMatches: 0,
        nGaps: 0,
        matchRatePct: 0,
      },
      topMetier: null,
      metierRanking: [],
      matches: [],
      gaps: [],
      topMetierGaps: [],
    };
  }

  private readCaseInsensitiveValue(row: Record<string, unknown>, candidates: string[]): string {
    const lookup = new Map<string, unknown>();
    for (const [key, value] of Object.entries(row)) {
      lookup.set(key.toLowerCase(), value);
    }

    for (const candidate of candidates) {
      const value = lookup.get(candidate.toLowerCase());
      if (value === undefined || value === null) continue;

      const text = String(value).trim();
      if (text.length > 0) {
        return text;
      }
    }

    return '';
  }

  private async getLatestCvSubmissionMeta(authId: string): Promise<LatestCvSubmissionMeta | null> {
    const { data, error } = await this.supabase
      .from('cv_submissions')
      .select('id, metier_id, updated_at, created_at')
      .eq('auth_id', authId)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row?.id) {
      return null;
    }

    return {
      id: String(row.id),
      metierId: this.normalizeMetierId(row.metier_id),
      updatedAt: String(row.updated_at ?? row.created_at ?? ''),
    };
  }

  private async loadStudentSkillsForMatching(cvSubmissionId: string): Promise<Array<{
    nom: string;
    niveau: string;
    type: string;
  }>> {
    const { data, error } = await this.supabase
      .from('cv_skills')
      .select('nom, niveau, skill_type, category')
      .eq('cv_submission_id', cvSubmissionId)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];
    const hardRows = rows.filter(
      (row: any) => String(row?.category ?? '').trim().toLowerCase() === 'hard',
    );

    const sourceRows = hardRows.length > 0 ? hardRows : rows;

    return sourceRows
      .map((row: any) => ({
        nom: String(row?.nom ?? '').trim(),
        niveau: this.normalizeSkillLevel(row?.niveau),
        type: String(row?.skill_type ?? '').trim(),
      }))
      .filter((row) => row.nom.length > 0);
  }

  private async loadReferenceCompetencesForMatching(): Promise<Array<{
    domaine: string;
    metier: string;
    competence: string;
    type_competence: string;
    mots_cles: string;
  }>> {
    const { data, error } = await this.supabase
      .from('liste_competences')
      .select('*')
      .limit(5000);

    if (error) throw error;

    const rows = Array.isArray(data) ? data : [];

    return rows
      .map((raw: any) => {
        const row = (raw ?? {}) as Record<string, unknown>;
        const competence = this.readCaseInsensitiveValue(row, ['Competence', 'competence']);

        return {
          domaine: this.readCaseInsensitiveValue(row, ['Domaine', 'domaine']),
          metier: this.readCaseInsensitiveValue(row, ['Metier', 'metier']),
          competence,
          type_competence: this.readCaseInsensitiveValue(row, ['Type_Competence', 'type_competence']),
          mots_cles: this.readCaseInsensitiveValue(row, ['Mots_Cles', 'mots_cles']),
        };
      })
      .filter((row) => row.competence.length > 0);
  }

  private normalizeMatchingText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeMatchingText(value: unknown): string[] {
    const normalized = this.normalizeMatchingText(value);
    if (!normalized) return [];
    const matches = normalized.match(/[a-z0-9_]{2,}/g);
    return matches ?? [];
  }

  private tokenSimilarity(left: string[], right: string[]): number {
    if (!left.length || !right.length) return 0;

    const leftSet = new Set(left);
    const rightSet = new Set(right);

    let intersection = 0;
    for (const token of leftSet) {
      if (rightSet.has(token)) intersection += 1;
    }

    if (!intersection) return 0;

    const overlap = intersection / Math.max(rightSet.size, 1);
    const union = leftSet.size + rightSet.size - intersection;
    const jaccard = union > 0 ? intersection / union : 0;

    return Number((overlap * 0.7 + jaccard * 0.3).toFixed(4));
  }

  private computeLocalMatchingFallback(
    cvSubmissionId: string,
    selectedMetierId: string,
    studentSkills: MatchingStudentSkillInput[],
    referenceCompetences: MatchingReferenceCompetenceInput[],
  ): MatchingAnalysisResult {
    const generatedAt = new Date().toISOString();
    const threshold = this.matchingThreshold;

    const normalizedSkills = studentSkills
      .map((skill) => ({
        ...skill,
        normalizedName: this.normalizeMatchingText(skill.nom),
        tokens: this.tokenizeMatchingText(skill.nom),
        niveauWeight: this.matchingNiveauWeight(skill.niveau),
      }))
      .filter((skill) => skill.normalizedName.length > 0);

    const matches: MatchingGapEntry[] = [];
    const gaps: MatchingGapEntry[] = [];

    const groupedByMetier = new Map<string, {
      domaine: string;
      entries: Array<{ score: number; rawScore: number; bestSkill: string }>;
    }>();

    for (const ref of referenceCompetences) {
      const refCompetence = String(ref.competence ?? '').trim();
      if (!refCompetence) continue;

      const refTokens = this.tokenizeMatchingText(
        `${ref.competence} ${ref.mots_cles ?? ''} ${ref.type_competence ?? ''}`,
      );

      let bestScore = 0;
      let bestRawScore = 0;
      let bestSkillName = '';
      let bestSkillNiveau = '';

      for (const skill of normalizedSkills) {
        const rawScore = this.tokenSimilarity(skill.tokens, refTokens);
        const weightedScore = rawScore * skill.niveauWeight;
        if (weightedScore > bestScore) {
          bestScore = weightedScore;
          bestRawScore = rawScore;
          bestSkillName = skill.nom;
          bestSkillNiveau = skill.niveau;
        }
      }

      const entry: MatchingGapEntry = {
        refCompetence,
        refMetier: String(ref.metier ?? '').trim() || 'Metier non defini',
        refDomaine: String(ref.domaine ?? '').trim() || 'Domaine non defini',
        refType: String(ref.type_competence ?? '').trim(),
        refMotsCles: String(ref.mots_cles ?? '').trim(),
        bestCvSkill: bestSkillName,
        bestCvNiveau: bestSkillNiveau,
        similarityScore: Number(bestScore.toFixed(4)),
        // Match/gap decision stays on semantic score; niveau weight affects prioritization and coverage.
        status: bestRawScore >= threshold ? 'match' : 'gap',
      };

      if (entry.status === 'match') {
        matches.push(entry);
      } else {
        gaps.push(entry);
      }

      const metierKey = entry.refMetier || 'Metier non defini';
      const bucket = groupedByMetier.get(metierKey) ?? {
        domaine: entry.refDomaine || 'Domaine non defini',
        entries: [],
      };
      bucket.entries.push({
        score: entry.similarityScore,
        rawScore: Number(bestRawScore.toFixed(4)),
        bestSkill: entry.bestCvSkill,
      });
      groupedByMetier.set(metierKey, bucket);
    }

    const metierRanking: MatchingMetierRankingEntry[] = [];
    for (const [metier, bucket] of groupedByMetier.entries()) {
      const nCompetences = bucket.entries.length;
      const matched = bucket.entries.filter((entry) => entry.rawScore >= threshold).length;
      const coveragePct = nCompetences > 0
        ? Number((bucket.entries.reduce((sum, entry) => sum + entry.score, 0) / nCompetences * 100).toFixed(1))
        : 0;

      const avgScore = nCompetences > 0
        ? Number((bucket.entries.reduce((sum, entry) => sum + entry.rawScore, 0) / nCompetences).toFixed(4))
        : 0;

      const topSkillScores = new Map<string, number>();
      for (const entry of bucket.entries) {
        if (!entry.bestSkill) continue;
        const current = topSkillScores.get(entry.bestSkill) ?? 0;
        if (entry.score > current) {
          topSkillScores.set(entry.bestSkill, entry.score);
        }
      }

      const topSkills = Array.from(topSkillScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([skill, score]) => ({
          skill,
          score: Number(score.toFixed(4)),
        }));

      metierRanking.push({
        metier,
        domaine: bucket.domaine,
        nCompetences,
        matched,
        coveragePct,
        avgScore,
        topSkills,
      });
    }

    metierRanking.sort((left, right) => (
      right.coveragePct - left.coveragePct
      || right.avgScore - left.avgScore
      || left.metier.localeCompare(right.metier)
    ));

    const topMetier = metierRanking.length ? metierRanking[0] : null;
    const sortedGaps = [...gaps].sort((left, right) => right.similarityScore - left.similarityScore);
    const topMetierGaps = topMetier
      ? sortedGaps.filter((gap) => gap.refMetier === topMetier.metier).slice(0, 40)
      : [];

    const nMatches = matches.length;
    const nGaps = gaps.length;
    const total = Math.max(nMatches + nGaps, 1);

    return {
      cvSubmissionId,
      selectedMetierId,
      generatedAt,
      modelName: 'local-token-fallback',
      threshold,
      summary: {
        nSkills: normalizedSkills.length,
        nMatches,
        nGaps,
        matchRatePct: Number(((nMatches / total) * 100).toFixed(1)),
      },
      topMetier,
      metierRanking,
      matches,
      gaps: sortedGaps.slice(0, CvSubmissionService.MAX_MATCHING_GAPS),
      topMetierGaps,
    };
  }

  private normalizeMatchingAnalysisPayload(
    cvSubmissionId: string,
    selectedMetierId: string,
    payload: any,
  ): MatchingAnalysisResult {
    const toNumber = (value: unknown, fallback = 0): number => {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    };

    const rawSummary = (payload?.summary ?? {}) as Record<string, unknown>;
    const rawTopMetier = payload?.top_metier ?? payload?.topMetier;
    const rawMetierRanking = Array.isArray(payload?.metier_ranking)
      ? payload.metier_ranking
      : (Array.isArray(payload?.metierRanking) ? payload.metierRanking : []);
    const rawMatches = Array.isArray(payload?.matches) ? payload.matches : [];
    const rawGaps = Array.isArray(payload?.gaps) ? payload.gaps : [];
    const rawTopMetierGaps = Array.isArray(payload?.top_metier_gaps)
      ? payload.top_metier_gaps
      : (Array.isArray(payload?.topMetierGaps) ? payload.topMetierGaps : []);

    const mapTopSkills = (skills: unknown): MatchingTopSkill[] => {
      if (!Array.isArray(skills)) return [];
      return skills
        .map((raw) => {
          const row = (raw ?? {}) as Record<string, unknown>;
          return {
            skill: String(row.skill ?? '').trim(),
            score: Number(toNumber(row.score, 0).toFixed(4)),
          };
        })
        .filter((entry) => entry.skill.length > 0);
    };

    const mapRankingEntry = (raw: unknown): MatchingMetierRankingEntry => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        metier: String(row.metier ?? '').trim(),
        domaine: String(row.domaine ?? '').trim(),
        nCompetences: Math.max(0, Math.round(toNumber(row.n_competences ?? row.nCompetences, 0))),
        matched: Math.max(0, Math.round(toNumber(row.matched, 0))),
        coveragePct: Number(toNumber(row.coverage_pct ?? row.coveragePct, 0).toFixed(1)),
        avgScore: Number(toNumber(row.avg_score ?? row.avgScore, 0).toFixed(4)),
        topSkills: mapTopSkills(row.top_skills ?? row.topSkills),
      };
    };

    const mapGapEntry = (raw: unknown): MatchingGapEntry => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        refCompetence: String(row.ref_competence ?? row.refCompetence ?? '').trim(),
        refMetier: String(row.ref_metier ?? row.refMetier ?? '').trim(),
        refDomaine: String(row.ref_domaine ?? row.refDomaine ?? '').trim(),
        refType: String(row.ref_type ?? row.refType ?? '').trim(),
        refMotsCles: String(row.ref_mots_cles ?? row.refMotsCles ?? '').trim(),
        bestCvSkill: String(row.best_cv_skill ?? row.bestCvSkill ?? '').trim(),
        bestCvNiveau: String(row.best_cv_niveau ?? row.bestCvNiveau ?? '').trim(),
        similarityScore: Number(toNumber(row.similarity_score ?? row.similarityScore, 0).toFixed(4)),
        status: String(row.status ?? '').trim().toLowerCase() === 'match' ? 'match' : 'gap',
      };
    };

    const metierRanking = rawMetierRanking.map((entry: unknown) => mapRankingEntry(entry));
    const topMetier = rawTopMetier ? mapRankingEntry(rawTopMetier) : null;

    return {
      cvSubmissionId,
      selectedMetierId,
      generatedAt: String(payload?.generatedAt ?? payload?.generated_at ?? new Date().toISOString()).trim(),
      modelName: String(payload?.model_name ?? payload?.modelName ?? '').trim(),
      threshold: Number(toNumber(payload?.threshold, this.matchingThreshold).toFixed(4)),
      summary: {
        nSkills: Math.max(0, Math.round(toNumber(rawSummary.n_skills ?? rawSummary.nSkills, 0))),
        nMatches: Math.max(0, Math.round(toNumber(rawSummary.n_matches ?? rawSummary.nMatches, 0))),
        nGaps: Math.max(0, Math.round(toNumber(rawSummary.n_gaps ?? rawSummary.nGaps, 0))),
        matchRatePct: Number(toNumber(rawSummary.match_rate_pct ?? rawSummary.matchRatePct, 0).toFixed(1)),
      },
      topMetier,
      metierRanking,
      matches: rawMatches.map((entry: unknown) => mapGapEntry(entry)),
      gaps: rawGaps.map((entry: unknown) => mapGapEntry(entry)),
      topMetierGaps: rawTopMetierGaps.map((entry: unknown) => mapGapEntry(entry)),
    };
  }

  private isMissingMatchingTableError(error: any): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    return (
      message.includes('cv_matching_analysis')
      || message.includes('cv_matching_metier_scores')
      || message.includes('cv_matching_competence_results')
    );
  }

  private logMissingMatchingTableOnce(): void {
    if (this.matchingTableMissingLogged) return;
    this.matchingTableMissingLogged = true;
    this.logger.warn('Matching persistence tables are not available yet; using transient matching cache only.');
  }

  private logMissingMatchingTraceTableOnce(): void {
    if (this.matchingTraceTableMissingLogged) return;
    this.matchingTraceTableMissingLogged = true;
    this.logger.warn('Matching trace tables are not available yet; normalized metier/competence rows will be skipped.');
  }

  private async insertRowsInChunks(
    tableName: string,
    rows: any[],
    chunkSize = 500,
  ): Promise<void> {
    if (!Array.isArray(rows) || rows.length === 0) return;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await this.supabase
        .from(tableName)
        .insert(chunk);

      if (error) throw error;
    }
  }

  private buildMatchingTraceRows(
    analysisId: string,
    authId: string,
    cvSubmissionId: string,
    result: MatchingAnalysisResult,
  ): { metierRows: any[]; competenceRows: any[] } {
    const metierRankByName = new Map<string, number>();

    const metierRows = (result.metierRanking ?? []).map((entry, index) => {
      const metierName = String(entry?.metier ?? '').trim() || 'Metier non defini';
      const normalizedMetier = this.normalizeMatchingText(metierName);
      const rankPosition = index + 1;

      if (normalizedMetier) {
        metierRankByName.set(normalizedMetier, rankPosition);
      }

      return {
        analysis_id: analysisId,
        cv_submission_id: cvSubmissionId,
        auth_id: authId,
        rank_position: rankPosition,
        metier_name: metierName,
        domaine_name: String(entry?.domaine ?? '').trim() || null,
        n_competences: Math.max(0, Math.round(Number(entry?.nCompetences ?? 0))),
        matched_competences: Math.max(0, Math.round(Number(entry?.matched ?? 0))),
        coverage_pct: Number(entry?.coveragePct ?? 0),
        avg_score: Number(entry?.avgScore ?? 0),
        top_skills: Array.isArray(entry?.topSkills) ? entry.topSkills : [],
      };
    });

    const topMetierNormalized = this.normalizeMatchingText(result.topMetier?.metier ?? '');

    const mapCompetenceRow = (entry: MatchingGapEntry, sourceBucket: 'matches' | 'gaps') => {
      const metierName = String(entry?.refMetier ?? '').trim() || 'Metier non defini';
      const normalizedMetier = this.normalizeMatchingText(metierName);
      const metierRank = normalizedMetier
        ? (metierRankByName.get(normalizedMetier) ?? null)
        : null;

      return {
        analysis_id: analysisId,
        cv_submission_id: cvSubmissionId,
        auth_id: authId,
        metier_name: metierName,
        domaine_name: String(entry?.refDomaine ?? '').trim() || null,
        metier_rank: metierRank,
        is_top_metier: !!topMetierNormalized && normalizedMetier === topMetierNormalized,
        status: entry?.status === 'match' ? 'match' : 'gap',
        source_bucket: sourceBucket,
        competence_name: String(entry?.refCompetence ?? '').trim(),
        competence_type: String(entry?.refType ?? '').trim() || null,
        keywords: String(entry?.refMotsCles ?? '').trim() || null,
        best_cv_skill: String(entry?.bestCvSkill ?? '').trim() || null,
        best_cv_level: String(entry?.bestCvNiveau ?? '').trim() || null,
        similarity_score: Number(entry?.similarityScore ?? 0),
      };
    };

    const competenceRows = [
      ...(result.matches ?? []).map((entry) => mapCompetenceRow(entry, 'matches')),
      ...(result.gaps ?? []).map((entry) => mapCompetenceRow(entry, 'gaps')),
    ].filter((row) => row.competence_name.length > 0);

    return {
      metierRows,
      competenceRows,
    };
  }

  private async persistMatchingTraceRows(
    analysisId: string,
    authId: string,
    latest: LatestCvSubmissionMeta,
    result: MatchingAnalysisResult,
  ): Promise<void> {
    const { metierRows, competenceRows } = this.buildMatchingTraceRows(
      analysisId,
      authId,
      latest.id,
      result,
    );

    const { error: deleteCompetenceErr } = await this.supabase
      .from('cv_matching_competence_results')
      .delete()
      .eq('analysis_id', analysisId);

    if (deleteCompetenceErr) throw deleteCompetenceErr;

    const { error: deleteMetierErr } = await this.supabase
      .from('cv_matching_metier_scores')
      .delete()
      .eq('analysis_id', analysisId);

    if (deleteMetierErr) throw deleteMetierErr;

    await this.insertRowsInChunks('cv_matching_metier_scores', metierRows, 250);
    await this.insertRowsInChunks('cv_matching_competence_results', competenceRows, 500);
  }

  private async loadPersistedMatchingAnalysis(
    authId: string,
    latest: LatestCvSubmissionMeta,
    fingerprint: string,
  ): Promise<MatchingAnalysisResult | null> {
    const { data, error } = await this.supabase
      .from('cv_matching_analysis')
      .select('analysis_fingerprint, metier_id, analysis_result')
      .eq('auth_id', authId)
      .eq('cv_submission_id', latest.id)
      .limit(1);

    if (error) {
      if (this.isMissingMatchingTableError(error)) {
        this.logMissingMatchingTableOnce();
        return null;
      }
      this.logger.warn(`Unable to read persisted matching analysis: ${error?.message ?? error}`);
      return null;
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row) return null;

    const persistedFingerprint = String((row as any)?.analysis_fingerprint ?? '').trim();
    if (!persistedFingerprint || persistedFingerprint !== fingerprint) {
      return null;
    }

    const persistedPayload = (row as any)?.analysis_result;
    const persistedMetierId = this.normalizeMetierId((row as any)?.metier_id) || latest.metierId;
    return this.normalizeMatchingAnalysisPayload(latest.id, persistedMetierId, persistedPayload);
  }

  private async persistMatchingAnalysis(
    authId: string,
    latest: LatestCvSubmissionMeta,
    fingerprint: string,
    result: MatchingAnalysisResult,
  ): Promise<void> {
    const row = {
      auth_id: authId,
      cv_submission_id: latest.id,
      metier_id: latest.metierId || null,
      analysis_fingerprint: fingerprint,
      model_name: result.modelName || null,
      match_threshold: result.threshold,
      analysis_result: result,
      generated_at: result.generatedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('cv_matching_analysis')
      .upsert([row], { onConflict: 'cv_submission_id' })
      .select('id')
      .single();

    if (error) {
      if (this.isMissingMatchingTableError(error)) {
        this.logMissingMatchingTableOnce();
        return;
      }
      this.logger.warn(`Unable to persist matching analysis: ${error?.message ?? error}`);
      return;
    }

    const analysisId = String((data as any)?.id ?? '').trim();
    if (!analysisId) {
      this.logger.warn('Matching analysis persisted without id; normalized trace rows were skipped.');
      return;
    }

    try {
      await this.persistMatchingTraceRows(analysisId, authId, latest, result);
    } catch (err: any) {
      if (this.isMissingMatchingTableError(err)) {
        this.logMissingMatchingTraceTableOnce();
        return;
      }
      this.logger.warn(`Unable to persist matching trace rows: ${err?.message ?? err}`);
    }
  }

  private async callMatchingPythonService(payload: unknown): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.matchingPythonTimeoutMs);

    try {
      const response = await fetch(`${this.matchingPythonServiceUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Python matching service failed (${response.status}): ${text}`);
      }

      return await response.json();
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw new Error(
          `Timed out after ${this.matchingPythonTimeoutMs}ms while calling ${this.matchingPythonServiceUrl}/analyze`,
        );
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getMatchingAnalysis(authId: string, force = false): Promise<MatchingAnalysisResult> {
    const latest = await this.getLatestCvSubmissionMeta(authId);
    if (!latest) {
      return this.createEmptyMatchingAnalysisResult();
    }

    const fingerprint = `${CvSubmissionService.MATCHING_ANALYSIS_VERSION}:${latest.id}:${latest.updatedAt}`;
    const cached = this.matchingAnalysisCache.get(authId);
    if (!force && cached && cached.fingerprint === fingerprint) {
      return cached.result;
    }

    if (!force) {
      const persisted = await this.loadPersistedMatchingAnalysis(authId, latest, fingerprint);
      if (persisted) {
        this.matchingAnalysisCache.set(authId, {
          fingerprint,
          result: persisted,
          cachedAt: new Date().toISOString(),
        });
        return persisted;
      }
    }

    const [studentSkills, referenceCompetences] = await Promise.all([
      this.loadStudentSkillsForMatching(latest.id),
      this.loadReferenceCompetencesForMatching(),
    ]);

    if (referenceCompetences.length === 0) {
      this.logger.warn('Matching analysis skipped: liste_competences is empty.');
      return this.createEmptyMatchingAnalysisResult(latest.id, latest.metierId);
    }

    const pythonPayload = {
      cv_submission_id: latest.id,
      match_threshold: this.matchingThreshold,
      student_skills: studentSkills,
      reference_competences: referenceCompetences,
    };

    let normalized: MatchingAnalysisResult;
    try {
      const rawResult = await this.callMatchingPythonService(pythonPayload);
      normalized = this.normalizeMatchingAnalysisPayload(
        latest.id,
        latest.metierId,
        rawResult,
      );
    } catch (err: any) {
      this.logger.warn(`Python matching service unavailable, using local fallback: ${err?.message ?? err}`);
      normalized = this.computeLocalMatchingFallback(
        latest.id,
        latest.metierId,
        studentSkills,
        referenceCompetences,
      );
    }

    await this.persistMatchingAnalysis(authId, latest, fingerprint, normalized);

    this.matchingAnalysisCache.set(authId, {
      fingerprint,
      result: normalized,
      cachedAt: new Date().toISOString(),
    });

    return normalized;
  }

  async getMatchingAnalysisTrace(authId: string, force = false): Promise<MatchingAnalysisTraceResult> {
    const analysis = await this.getMatchingAnalysis(authId, force);
    if (!analysis.cvSubmissionId) {
      return {
        analysis,
        analysisId: null,
        analysisFingerprint: '',
        metierScores: [],
        competenceResults: [],
      };
    }

    const { data: analysisRow, error: analysisErr } = await this.supabase
      .from('cv_matching_analysis')
      .select('id, analysis_fingerprint')
      .eq('auth_id', authId)
      .eq('cv_submission_id', analysis.cvSubmissionId)
      .maybeSingle();

    if (analysisErr) {
      if (this.isMissingMatchingTableError(analysisErr)) {
        this.logMissingMatchingTableOnce();
      } else {
        this.logger.warn(`Unable to read matching trace root row: ${analysisErr?.message ?? analysisErr}`);
      }

      return {
        analysis,
        analysisId: null,
        analysisFingerprint: '',
        metierScores: [],
        competenceResults: [],
      };
    }

    const analysisId = String((analysisRow as any)?.id ?? '').trim();
    const analysisFingerprint = String((analysisRow as any)?.analysis_fingerprint ?? '').trim();

    if (!analysisId) {
      return {
        analysis,
        analysisId: null,
        analysisFingerprint,
        metierScores: [],
        competenceResults: [],
      };
    }

    const [{ data: metierScores, error: metierErr }, { data: competenceResults, error: competenceErr }] = await Promise.all([
      this.supabase
        .from('cv_matching_metier_scores')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('rank_position', { ascending: true }),
      this.supabase
        .from('cv_matching_competence_results')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('similarity_score', { ascending: false }),
    ]);

    if (metierErr) {
      if (this.isMissingMatchingTableError(metierErr)) {
        this.logMissingMatchingTraceTableOnce();
      } else {
        this.logger.warn(`Unable to read matching metier trace rows: ${metierErr?.message ?? metierErr}`);
      }
    }

    if (competenceErr) {
      if (this.isMissingMatchingTableError(competenceErr)) {
        this.logMissingMatchingTraceTableOnce();
      } else {
        this.logger.warn(`Unable to read matching competence trace rows: ${competenceErr?.message ?? competenceErr}`);
      }
    }

    return {
      analysis,
      analysisId,
      analysisFingerprint,
      metierScores: Array.isArray(metierScores) ? metierScores : [],
      competenceResults: Array.isArray(competenceResults) ? competenceResults : [],
    };
  }

  private async enrichPayloadForMatching(payload: any, authId?: string): Promise<any> {
    const basePayload = payload ?? {};
    if (!authId) {
      return basePayload;
    }

    try {
      const extractedInventory = await this.extractAllHardSkillsFromNotes(authId);
      if (!extractedInventory.length) {
        return basePayload;
      }

      const incomingHard = this.normalizeIncomingHardSkills(basePayload?.hardSkills);
      const extractedHard = extractedInventory.map((s) => ({
        type: String(s.type ?? 'Metier T&L').trim() || 'Metier T&L',
        nom: String(s.nom ?? '').trim(),
        niveau: this.normalizeSkillLevel(s.niveau),
        contexte: CvSubmissionService.AUTO_SKILL_CONTEXT,
        metierIds: this.parseMetierIds(s.metierIds),
      })).filter((s) => s.nom.length > 0);

      const mergedHard = this.dedupeSkillList([...incomingHard, ...extractedHard]).map((s) => ({
        type: s.type,
        nom: s.nom,
        niveau: s.niveau,
        contexte: s.contexte ?? null,
      }));

      return {
        ...basePayload,
        hardSkills: mergedHard,
      };
    } catch (err: any) {
      this.logger.warn(`Failed to enrich ATS payload with extracted hard skills: ${err?.message ?? err}`);
      return basePayload;
    }
  }

  async calculateAtsScore(payload: any, authId?: string): Promise<AtsScoreResult> {
    const payloadForMatching = await this.enrichPayloadForMatching(payload, authId);
    const resumeText = this.buildResumeText(payloadForMatching);
    const referenceKeywords = await this.loadReferenceKeywordsSafely();
    const qualityScore = this.computeCvQualityScore(payload);

    try {
      const prompt = this.buildScorePrompt(resumeText, referenceKeywords);
      const rawResponse = await this.generateGeminiText(prompt);
      const parsedMatch = this.parseScore(rawResponse, /Job Description Match[:\s]*([0-9]{1,3})\s*%/i);
      const parsedSuccess = this.parseScore(rawResponse, /Application Success rates?[:\s]*([0-9]{1,3})\s*%/i);

      if (parsedMatch !== null && parsedSuccess !== null) {
        const matchScore = this.clampScore(Math.round(parsedMatch * 0.75 + qualityScore * 0.25));
        const successScore = this.clampScore(Math.round(parsedSuccess * 0.6 + qualityScore * 0.4));
        return {
          matchScore,
          successScore,
          atsScore: this.clampScore(Math.round((matchScore + successScore) / 2)),
          rawResponse,
        };
      }

      this.logger.warn('Gemini response format mismatch; applying deterministic fallback score.');
      const fallback = this.computeFallbackScore(resumeText, referenceKeywords, qualityScore);
      return {
        ...fallback,
        rawResponse,
      };
    } catch (err: any) {
      const errMessage = String(err?.message ?? err ?? 'unknown error');
      this.logger.warn(`Gemini scoring failed, using fallback score: ${errMessage}`);

      const fallback = this.computeFallbackScore(resumeText, referenceKeywords, qualityScore);
      return {
        ...fallback,
        rawResponse: `FALLBACK_SCORE: ${errMessage}`,
      };
    }
  }

  private getGeminiProviders(): GeminiProviderConfig[] {
    const providers: GeminiProviderConfig[] = [];

    if (this.geminiPrimaryApiKey) {
      providers.push({
        name: 'primary',
        apiKey: this.geminiPrimaryApiKey,
        model: this.geminiPrimaryModel,
      });
    }

    if (this.geminiSecondaryApiKey && this.geminiSecondaryApiKey !== this.geminiPrimaryApiKey) {
      providers.push({
        name: 'secondary',
        apiKey: this.geminiSecondaryApiKey,
        model: this.geminiSecondaryModel,
      });
    }

    return providers;
  }

  private disableGeminiProvider(provider: GeminiProviderConfig, reason: string): void {
    if (this.disabledGeminiProviders.has(provider.name)) {
      return;
    }

    this.disabledGeminiProviders.add(provider.name);
    this.logger.error(`Gemini ${provider.name} provider disabled: ${reason}`);
  }

  private async loadReferenceKeywordsSafely(): Promise<string[]> {
    try {
      const keywords = await this.loadReferenceKeywords();
      if (keywords.length > 0) {
        return keywords;
      }
      this.logger.warn('Reference keywords from database are empty; using defaults only.');
    } catch (err: any) {
      this.logger.error(`Failed to load database keywords, using defaults only: ${err?.message ?? err}`);
    }

    return this.defaultReferenceKeywords();
  }

  private defaultReferenceKeywords(): string[] {
    return [
      'logistique', 'transport', 'supply', 'douane', 'wms', 'tms', 'sap', 'incoterms', 'excel', 'powerbi',
      'inventaire', 'entrepot', 'flux', 'optimisation', 'planification', 'approvisionnement', 'distribution',
      'lean', 'kpi', 'analyse', 'operation', 'procurement', 'forecast', 'service', 'qualite', 'securite',
    ];
  }

  private computeFallbackScore(
    resumeText: string,
    referenceKeywords: string[],
    qualityScore: number,
  ): Omit<AtsScoreResult, 'rawResponse'> {
    const resumeTokens = new Set(this.extractKeywords(resumeText));
    const matched = referenceKeywords.filter((k) => resumeTokens.has(k)).length;
    const rawMatch = this.clampScore(
      Math.round((matched / Math.max(referenceKeywords.length, 1)) * 100),
    );
    const matchScore = this.clampScore(Math.round(rawMatch * 0.65 + qualityScore * 0.35));
    const successScore = this.clampScore(Math.round(qualityScore * 0.7 + matchScore * 0.3));

    return {
      matchScore,
      successScore,
      atsScore: this.clampScore(Math.round((matchScore + successScore) / 2)),
    };
  }

  private computeCvQualityScore(payload: any): number {
    const safe = (v: any) => String(v ?? '').trim();
    const wordCount = (v: any) => safe(v).split(/\s+/).filter(Boolean).length;

    let points = 0;

    if (safe(payload?.professionalTitle)) points += 8;
    if (safe(payload?.specialization)) points += 4;
    if (wordCount(payload?.objectif) >= 10) points += 12;

    if (safe(payload?.info?.linkedin)) points += 4;
    if (safe(payload?.info?.permis)) points += 2;

    const formations = Array.isArray(payload?.formations) ? payload.formations : [];
    const hasSolidFormation = formations.some((f: any) => safe(f?.diplome) && safe(f?.institution));
    if (hasSolidFormation) points += 15;

    const experiences = Array.isArray(payload?.experiences) ? payload.experiences : [];
    const strongExperiences = experiences.filter((e: any) => (
      safe(e?.poste)
      && safe(e?.entreprise)
      && wordCount(e?.description) >= 20
    )).length;
    if (strongExperiences >= 1) points += 20;
    if (strongExperiences >= 2) points += 8;

    const hardSkills = Array.isArray(payload?.hardSkills) ? payload.hardSkills : [];
    const softSkills = Array.isArray(payload?.softSkills) ? payload.softSkills : [];
    const hardNamedCount = hardSkills.filter((s: any) => safe(s?.nom)).length;
    const softContextCount = softSkills.filter((s: any) => safe(s?.nom) && wordCount(s?.contexte) >= 4).length;
    points += Math.min(12, hardNamedCount * 2);
    points += Math.min(8, softContextCount * 2);

    const langues = Array.isArray(payload?.langues) ? payload.langues : [];
    const projets = Array.isArray(payload?.projets) ? payload.projets : [];
    const certifications = Array.isArray(payload?.certifications) ? payload.certifications : [];

    if (langues.some((l: any) => safe(l?.langue))) points += 4;
    if (projets.some((p: any) => safe(p?.titre) && wordCount(p?.description) >= 8)) points += 6;
    if (certifications.some((c: any) => safe(c?.titre))) points += 4;

    return this.clampScore(points);
  }

  private clampScore(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  private parseScore(text: string, regex: RegExp): number | null {
    const m = text.match(regex);
    if (!m) return null;
    const value = Number(m[1]);
    return Number.isFinite(value) ? value : null;
  }

  private async generateGeminiText(prompt: string): Promise<string> {
    const providers = this.getGeminiProviders();
    if (!providers.length) {
      throw new Error('No Gemini API key configured. Set GEMINI_API_KEY_PRIMARY (or GEMINI_API_KEY).');
    }

    const activeProviders = providers.filter((provider) => !this.disabledGeminiProviders.has(provider.name));
    if (!activeProviders.length) {
      throw new Error('All Gemini providers are disabled. Please configure a valid API key.');
    }

    let lastError: Error | null = null;

    for (const provider of activeProviders) {
      if (provider.name === 'secondary') {
        this.logger.warn('Gemini primary provider unavailable; trying secondary provider (plan B).');
      }

      try {
        return await this.generateGeminiTextWithProvider(provider, prompt);
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err ?? 'unknown error'));
      }
    }

    throw lastError ?? new Error('Gemini providers failed.');
  }

  private async generateGeminiTextWithProvider(provider: GeminiProviderConfig, prompt: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`;
    const maxAttempts = 4;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            topP: 0.1,
          },
        }),
      });

      if (!response.ok) {
        const text = await response.text();

        if (response.status === 403) {
          const lower = text.toLowerCase();
          if (lower.includes('reported as leaked') || lower.includes('permission_denied')) {
            this.disableGeminiProvider(
              provider,
              `API key rejected (reported leaked/permission denied) for model ${provider.model}.`,
            );
            throw new Error(`Gemini ${provider.name} provider rejected (403 permission denied).`);
          }
        }

        const transient = response.status === 429 || response.status === 503 || response.status >= 500;
        lastError = new Error(
          `Gemini API [${provider.name}/${provider.model}] failed (${response.status}): ${text}`,
        );

        if (transient && attempt < maxAttempts) {
          const waitMs = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
          this.logger.warn(
            `Gemini temporary error [${provider.name}/${provider.model}] (${response.status}) on attempt ${attempt}/${maxAttempts}; retrying in ${waitMs}ms.`,
          );
          await this.sleep(waitMs);
          continue;
        }

        throw lastError;
      }

      const json: any = await response.json();
      const parts = json?.candidates?.[0]?.content?.parts;
      if (!Array.isArray(parts)) {
        throw new Error('Gemini API returned an empty response payload.');
      }

      const text = parts
        .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
        .join('\n')
        .trim();

      if (!text) {
        throw new Error('Gemini API returned empty text content.');
      }

      return text;
    }

    throw lastError ?? new Error('Gemini API request failed after retries.');
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildScorePrompt(resumeText: string, referenceKeywords: string[]): string {
    return `
You are an advanced and highly experienced Applicant Tracking System (ATS) specialized in transport, logistics, and supply chain profiles.

Your task is to evaluate the resume against the reference keyword base provided below (coming from our database).

Rules:
1. Be strict and deterministic: for the same input, return the same scores.
2. Use only the resume content and reference keywords.
3. Output only numeric percentages between 1 and 100.
4. Do not add any explanation.

Resume: ${resumeText.slice(0, 14000)}
Reference Keywords: ${referenceKeywords.join(', ')}

Respond ONLY in this exact format with these exact section headers:
• Job Description Match: [number 1-100]%
• Application Success rates: [number 1-100]%
`.trim();
  }

  private async loadReferenceKeywords(): Promise<string[]> {
    const [competences, metiers, domaines] = await Promise.all([
      this.refCompetanceService.getReferentielCompetences(),
      this.refCompetanceService.getMetiers(),
      this.refCompetanceService.getDomaines(),
    ]);

    const keywordSet = new Set<string>();
    const addText = (value: unknown) => {
      if (typeof value !== 'string' || value.trim().length === 0) return;
      for (const kw of this.extractKeywords(value)) {
        keywordSet.add(kw);
      }
    };

    for (const c of competences as any[]) {
      addText(c?.competence);
      addText(c?.categorie);
      addText(c?.domaine);
    }

    for (const m of metiers as any[]) {
      addText(m?.nom_metier ?? m?.nom);
      addText(m?.domaine);
    }

    for (const d of domaines as any[]) {
      addText(d?.nom_domaine ?? d?.nom);
    }

    const defaults = ['logistique', 'transport', 'supply', 'douane', 'wms', 'tms', 'sap', 'incoterms', 'excel', 'powerbi'];
    for (const d of defaults) {
      keywordSet.add(d);
    }

    return Array.from(keywordSet).slice(0, 350);
  }

  private buildResumeText(payload: any): string {
    const safe = (v: any) => String(v ?? '').trim();
    const joinMapped = (arr: any, mapper: (item: any) => string) =>
      Array.isArray(arr) ? arr.map(mapper).join(' ') : '';

    const header = [
      safe(payload?.professionalTitle),
      safe(payload?.specialization),
      safe(payload?.objectif),
      safe(payload?.info?.permis),
      safe(payload?.info?.linkedin),
    ].join(' ');

    const formations = joinMapped(
      payload?.formations,
      (f) =>
        `${safe(f?.diplome)} ${safe(f?.institution)} ${safe(f?.modules)} ${safe(
          f?.pfeTitre,
        )} ${safe(f?.pfeTechnologies)}`,
    );
    const experiences = joinMapped(
      payload?.experiences,
      (e) =>
        `${safe(e?.poste)} ${safe(e?.entreprise)} ${safe(e?.secteur)} ${safe(
          e?.description,
        )} ${safe(e?.motsCles ?? e?.mots_cles)}`,
    );
    const hardSkills = joinMapped(
      payload?.hardSkills,
      (h) => `${safe(h?.type)} ${safe(h?.nom)} ${safe(h?.niveau)}`,
    );
    const softSkills = joinMapped(
      payload?.softSkills,
      (s) => `${safe(s?.nom)} ${safe(s?.niveau)} ${safe(s?.contexte)}`,
    );
    const langues = joinMapped(
      payload?.langues,
      (l) => `${safe(l?.langue)} ${safe(l?.niveau)} ${safe(l?.certification)} ${safe(l?.score)}`,
    );
    const projets = joinMapped(
      payload?.projets,
      (p) => `${safe(p?.titre)} ${safe(p?.description)} ${safe(p?.technologies)}`,
    );
    const certifications = joinMapped(
      payload?.certifications,
      (c) => `${safe(c?.titre)} ${safe(c?.organisme)} ${safe(c?.verification)}`,
    );

    return [
      header,
      formations,
      experiences,
      hardSkills,
      softSkills,
      langues,
      projets,
      certifications,
    ]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 2)
      .filter((token) => !['avec', 'pour', 'dans', 'une', 'des', 'les', 'sur', 'par', 'and', 'the'].includes(token));
  }
}
