import { Injectable } from '@nestjs/common';
import { getSupabase } from '../config/supabase.client';

@Injectable()
export class CvSubmissionService {
  private supabase = getSupabase();
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

    if (payload.formations?.length) {
      await this.supabase.from('cv_formations').insert(
        payload.formations.map((f: any, i: number) => ({
          ...f,
          cv_submission_id: cvSubmissionId,
          sort_order: i,
          date_debut: this.sanitizeDate(f.date_debut ?? f.dateDebut ?? f.startDate),
          date_fin: this.sanitizeDate(f.date_fin ?? f.dateFin ?? f.endDate),
        }))
      );
    }
    if (payload.experiences?.length) {
      await this.supabase.from('cv_experiences').insert(
        payload.experiences.map((e: any, i: number) => ({
          ...e,
          cv_submission_id: cvSubmissionId,
          sort_order: i,
          date_debut: this.sanitizeDate(e.date_debut ?? e.dateDebut ?? e.startDate),
          date_fin: this.sanitizeDate(e.date_fin ?? e.dateFin ?? e.endDate),
        }))
      );
    }

    const skills: any[] = [];
    if (payload.hardSkills?.length) {
      skills.push(...payload.hardSkills.map((s: any, i: number) => ({ ...s, category: 'hard', cv_submission_id: cvSubmissionId, sort_order: i })));
    }
    if (payload.softSkills?.length) {
      skills.push(...payload.softSkills.map((s: any, i: number) => ({ ...s, category: 'soft', cv_submission_id: cvSubmissionId, sort_order: i })));
    }
    if (skills.length) {
      await this.supabase.from('cv_skills').insert(skills);
    }

    if (payload.langues?.length) {
      await this.supabase.from('cv_langues').insert(
        payload.langues.map((l: any, i: number) => ({ ...l, cv_submission_id: cvSubmissionId, sort_order: i }))
      );
    }
    if (payload.projets?.length) {
      await this.supabase.from('cv_projets').insert(
        payload.projets.map((p: any, i: number) => ({ ...p, cv_submission_id: cvSubmissionId, sort_order: i }))
      );
    }
    if (payload.certifications?.length) {
      await this.supabase.from('cv_certifications').insert(
        payload.certifications.map((c: any, i: number) => ({
          ...c,
          cv_submission_id: cvSubmissionId,
          sort_order: i,
          date_obtenue: this.sanitizeDate(c.date_obtenue ?? c.dateObtenue ?? c.date),
        }))
      );
    }
    if (payload.engagements?.length) {
      await this.supabase.from('cv_engagements').insert(
        payload.engagements.map((e: any, i: number) => ({
          ...e,
          cv_submission_id: cvSubmissionId,
          sort_order: i,
          date_debut: this.sanitizeDate(e.date_debut ?? e.dateDebut ?? e.startDate),
          date_fin: this.sanitizeDate(e.date_fin ?? e.dateFin ?? e.endDate),
        }))
      );
    }
  }
}
