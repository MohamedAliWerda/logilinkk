import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AncienEtudiantsService {
  private readonly logger = new Logger(AncienEtudiantsService.name);
  private supabase: any;

  constructor() {
    // load keys from backend/.env if present
    const envPath = path.join(process.cwd(), '.env');
    let url = process.env.SUPABASE_URL;
    let key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    try {
      if (fs.existsSync(envPath)) {
        const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
          const m = line.match(/^([^=]+)=(.*)$/);
          if (m) acc[m[1]] = m[2];
          return acc;
        }, {} as Record<string,string>);
        url = url || env.SUPABASE_URL;
        key = key || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_KEY;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.warn('Could not read .env for supabase keys: ' + message);
    }

    if (!url || !key) {
      this.logger.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY; AncienEtudiantsService will not work');
      return;
    }

    this.supabase = createClient(url, key);
  }

  async fetchAll() {
    return this.fetchTable('ancien_etudiant');
  }

  async fetchTable(table: string) {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase.from(table).select('*');
    if (error) {
      this.logger.error('Supabase fetch error: ' + error.message);
      throw new Error(error.message);
    }
    return data;
  }

  async createAncienEtudiant(payload: Record<string, unknown>) {
    if (!this.supabase) {
      throw new Error('Supabase client is not configured');
    }

    const row = {
      NOM: String(payload.NOM ?? payload.nom ?? payload.fullName ?? '').trim(),
      EMAIL: String(payload.EMAIL ?? payload.email ?? '').trim(),
      PROMOTION: String(payload.PROMOTION ?? payload.promotion ?? '').trim(),
      'STATUT INVITATION': String(payload['STATUT INVITATION'] ?? payload.statutInvitation ?? 'Non contacté').trim() || 'Non contacté',
      'RÉPONSE': String(payload['RÉPONSE'] ?? payload.reponse ?? 'Non répondu').trim() || 'Non répondu',
      ACTIONS: String(payload.ACTIONS ?? payload.actions ?? 'Relancer').trim() || 'Relancer',
    };

    const { data, error } = await this.supabase
      .from('ancien_etudiant')
      .insert([row])
      .select('*')
      .single();

    if (error) {
      this.logger.error('Supabase insert error: ' + error.message);
      throw new Error(error.message);
    }

    return data;
  }

  async createFeedback(payload: Record<string, unknown>) {
    if (!this.supabase) {
      throw new Error('Supabase client is not configured');
    }

    const row = {
      nom_prenom: String(payload.nom_prenom ?? payload.NOM ?? payload.nom ?? payload.fullName ?? '').trim(),
      email: String(payload.email ?? payload.EMAIL ?? '').trim(),
      promotion: String(payload.promotion ?? payload.PROMOTION ?? '').trim(),
      diplome: String(payload.diplome ?? payload.DIPLOME ?? 'Licence').trim() || 'Licence',
      filiere: String(payload.filiere ?? payload.FILIERE ?? '').trim(),
      situation_actuelle: String(payload.situation_actuelle ?? payload.SITUATION_ACTUELLE ?? 'En recherche d\'emploi').trim() || 'En recherche d\'emploi',
      secteur: String(payload.secteur ?? payload.SECTEUR ?? '').trim(),
      poste_en_lien_formation: String(payload.poste_en_lien_formation ?? payload.POSTE_EN_LIEN_FORMATION ?? 'Pas du tout en lien').trim() || 'Pas du tout en lien',
      delai_premier_emploi: String(payload.delai_premier_emploi ?? payload.DELAI_PREMIER_EMPLOI ?? 'Encore en recherche').trim() || 'Encore en recherche',
      salaire_brut_mensuel: String(payload.salaire_brut_mensuel ?? payload.SALAIRE_BRUT_MENSUEL ?? 'Ne souhaite pas').trim() || 'Ne souhaite pas',
      canal_efficace: String(payload.canal_efficace ?? payload.CANAL_EFFICACE ?? 'LinkedIn').trim() || 'LinkedIn',
      competences_techniques: String(payload.competences_techniques ?? payload.COMPETENCES_TECHNIQUES ?? '0').trim() || '0',
      competences_gestion_projet: String(payload.competences_gestion_projet ?? payload.COMPETENCES_GESTION_PROJET ?? '0').trim() || '0',
      competences_numeriques: String(payload.competences_numeriques ?? payload.COMPETENCES_NUMERIQUES ?? '0').trim() || '0',
      competences_communication: String(payload.competences_communication ?? payload.COMPETENCES_COMMUNICATION ?? '0').trim() || '0',
      maitrise_langues: String(payload.maitrise_langues ?? payload.MAITRISE_LANGUES ?? '0').trim() || '0',
      capacite_adaptation: String(payload.capacite_adaptation ?? payload.CAPACITE_ADAPTATION ?? '0').trim() || '0',
      recommandation_isgis: String(payload.recommandation_isgis ?? payload.RECOMMANDATION_ISGIS ?? '0').trim() || '0',
      message_suggestion: String(payload.message_suggestion ?? payload.MESSAGE_SUGGESTION ?? '').trim(),
    };

    const { data, error } = await this.supabase
      .from('feedback')
      .insert([row])
      .select('*')
      .single();

    if (error) {
      this.logger.error('Supabase feedback insert error: ' + error.message);
      throw new Error(error.message);
    }

    return data;
  }
}
