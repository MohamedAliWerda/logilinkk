import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getSupabase } from '../config/supabase.client';
import { RefCompetanceService } from '../ref_competance/ref_competance.service';

type AtsScoreResult = {
  matchScore: number;
  successScore: number;
  atsScore: number;
  rawResponse: string;
};

@Injectable()
export class CvSubmissionService {
  private readonly logger = new Logger(CvSubmissionService.name);
  private readonly supabase = getSupabase();
  private readonly geminiModel = 'gemini-2.5-flash-lite';
  private readonly geminiApiKey: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly refCompetanceService: RefCompetanceService,
  ) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') ?? '';
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
      'cv_skills',
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

    // Skills (hard / soft) -> cv_skills expects: category, skill_type, nom, niveau, contexte
    const skills: any[] = [];
    if (payload.hardSkills?.length) {
      skills.push(...payload.hardSkills.map((s: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        category: 'hard',
        skill_type: s.type ?? s.skill_type ?? null,
        nom: s.nom ?? s.name ?? null,
        niveau: s.niveau ?? null,
        contexte: s.contexte ?? null,
      })));
    }
    if (payload.softSkills?.length) {
      skills.push(...payload.softSkills.map((s: any, i: number) => ({
        cv_submission_id: cvSubmissionId,
        sort_order: i,
        category: 'soft',
        skill_type: s.type ?? null,
        nom: s.nom ?? s.name ?? null,
        niveau: s.niveau ?? null,
        contexte: s.contexte ?? s.context ?? null,
      })));
    }
    if (skills.length) {
      const { error: skErr } = await this.supabase.from('cv_skills').insert(skills);
      if (skErr) {
        console.error('[cv-submissions] cv_skills insert error', skErr);
        throw skErr;
      }
    }

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

  async getCvByAuthId(authId: string): Promise<any | null> {
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
        case 'skills':
          result.hardSkills = data.filter((s: any) => s.category === 'hard');
          result.softSkills = data.filter((s: any) => s.category === 'soft');
          break;
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

  async calculateAtsScore(payload: any): Promise<AtsScoreResult> {
    const resumeText = this.buildResumeText(payload);
    const referenceKeywords = await this.loadReferenceKeywordsSafely();

    try {
      const prompt = this.buildScorePrompt(resumeText, referenceKeywords);
      const rawResponse = await this.generateGeminiText(prompt);
      const parsedMatch = this.parseScore(rawResponse, /Job Description Match[:\s]*([0-9]{1,3})\s*%/i);
      const parsedSuccess = this.parseScore(rawResponse, /Application Success rates?[:\s]*([0-9]{1,3})\s*%/i);

      if (parsedMatch !== null && parsedSuccess !== null) {
        const matchScore = this.clampScore(parsedMatch);
        const successScore = this.clampScore(parsedSuccess);
        return {
          matchScore,
          successScore,
          atsScore: this.clampScore(Math.round((matchScore + successScore) / 2)),
          rawResponse,
        };
      }

      this.logger.warn('Gemini response format mismatch; applying deterministic fallback score.');
      const fallback = this.computeFallbackScore(resumeText, referenceKeywords);
      return {
        ...fallback,
        rawResponse,
      };
    } catch (err: any) {
      this.logger.warn(`Gemini scoring failed, using fallback score: ${err?.message ?? err}`);
      const fallback = this.computeFallbackScore(resumeText, referenceKeywords);
      return {
        ...fallback,
        rawResponse: `FALLBACK_SCORE: ${err?.message ?? 'unknown error'}`,
      };
    }
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
  ): Omit<AtsScoreResult, 'rawResponse'> {
    const resumeTokens = new Set(this.extractKeywords(resumeText));
    const matched = referenceKeywords.filter((k) => resumeTokens.has(k)).length;
    const matchScore = this.clampScore(
      Math.round((matched / Math.max(referenceKeywords.length, 1)) * 100),
    );
    const successScore = this.clampScore(Math.round(matchScore * 0.9 + 5));

    return {
      matchScore,
      successScore,
      atsScore: this.clampScore(Math.round((matchScore + successScore) / 2)),
    };
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
    if (!this.geminiApiKey) {
      throw new Error('GEMINI_API_KEY is not configured in backend environment.');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiApiKey}`;
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
        const transient = response.status === 429 || response.status === 503 || response.status >= 500;
        lastError = new Error(`Gemini API failed (${response.status}): ${text}`);

        if (transient && attempt < maxAttempts) {
          const waitMs = 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
          this.logger.warn(
            `Gemini temporary error (${response.status}) on attempt ${attempt}/${maxAttempts}; retrying in ${waitMs}ms.`,
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
