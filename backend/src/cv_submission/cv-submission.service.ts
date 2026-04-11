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

@Injectable()
export class CvSubmissionService {
  private readonly logger = new Logger(CvSubmissionService.name);
  private readonly supabase = getSupabase();
  private readonly geminiPrimaryApiKey: string;
  private readonly geminiSecondaryApiKey: string;
  private readonly geminiPrimaryModel: string;
  private readonly geminiSecondaryModel: string;
  private readonly disabledGeminiProviders = new Set<string>();
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

    const lockedHard = this.dedupeSkillList(
      extractedHard.length > 0
        ? extractedHard
        : (systemHardExisting.length > 0 ? systemHardExisting : []),
    );

    const finalHard = this.dedupeSkillList(
      lockedHard.length > 0 ? lockedHard : incomingHard,
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
