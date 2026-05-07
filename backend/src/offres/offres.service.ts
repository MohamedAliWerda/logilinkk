import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class OffresService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }

  async createOffre(data: {
    titre_poste: string;
    societe: string;
    exigences: string;
    societe_id?: string;
  }) {
    try {
      if (!data.societe_id) {
        throw new Error('societe_id est obligatoire pour lier l\'offre a la societe');
      }

      const societeId = Number(data.societe_id);
      if (!Number.isInteger(societeId) || societeId <= 0) {
        throw new Error('societe_id invalide');
      }

      const societeExists = await this.checkSocieteExists(societeId);
      if (!societeExists) {
        throw new Error('societe_id introuvable dans la table Societe');
      }

      const insertedRow = await this.insertPostWithColumnFallbacks({
        societeId,
        titre_poste: data.titre_poste,
        exigences: data.exigences,
        societe: data.societe,
      });

      return {
        success: true,
        data: {
          id: String(insertedRow?.id_line ?? insertedRow?.id),
          id_line: insertedRow?.id_line,
          societe_id: insertedRow?.id,
          titre_poste: insertedRow?.['Titre du poste'] ?? insertedRow?.['titre_poste'] ?? '',
          societe:
            insertedRow?.['Sociéte']
            ?? insertedRow?.['Société']
            ?? insertedRow?.['Societe']
            ?? insertedRow?.['societe']
            ?? '',
          exigences: insertedRow?.Exigences ?? insertedRow?.['exigences'] ?? '',
          date_creation: insertedRow?.date_creation ?? new Date().toISOString(),
        },
        message: 'Offre créée avec succès',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la création',
        data: null,
      };
    }
  }

  async getActiveOffres() {
    try {
      const { data: offres, error } = await this.supabase
        .from('post')
        .select('*')
        .order('id_line', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        message: 'Offres récupérées avec succès',
        data: (offres || []).map((row: any) => ({
          id: String(row.id_line ?? row.id),
          id_line: row.id_line,
          societe_id: row.id,
          titre_poste: row['Titre du poste'] ?? row['titre_poste'] ?? '',
          societe: row['Sociéte'] ?? row['Société'] ?? row['Societe'] ?? row['societe'] ?? '',
          exigences: row.Exigences ?? row.exigences ?? '',
          date_creation: row.date_creation ?? new Date().toISOString(),
          candidaturesCount: 0,
          status: 'active',
        })),
      };
    } catch (error) {
      return {
        message: 'Erreur lors de la récupération des offres',
        data: {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur lors de la récupération',
          data: [],
        },
      };
    }
  }

  async getOffresByCompany(societeId: string) {
    try {
      const parsedSocieteId = Number(societeId);
      if (!Number.isInteger(parsedSocieteId) || parsedSocieteId <= 0) {
        throw new Error('societeId invalide');
      }

      const { data: offres, error } = await this.supabase
        .from('post')
        .select('*')
        .eq('id', parsedSocieteId)
        .order('id_line', { ascending: false });

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        message: 'Offres société récupérées avec succès',
        data: (offres || []).map((row: any) => ({
          id: String(row.id_line ?? row.id),
          id_line: row.id_line,
          societe_id: row.id,
          titre_poste: row['Titre du poste'] ?? row['titre_poste'] ?? '',
          societe: row['Sociéte'] ?? row['Société'] ?? row['Societe'] ?? row['societe'] ?? '',
          exigences: row.Exigences ?? row.exigences ?? '',
          date_creation: row.date_creation ?? new Date().toISOString(),
          candidaturesCount: 0,
          status: 'active',
        })),
      };
    } catch (error) {
      return {
        message: 'Erreur lors de la récupération des offres société',
        data: {
          success: false,
          error: error instanceof Error ? error.message : 'Erreur lors de la récupération',
          data: [],
        },
      };
    }
  }

  async updateOffre(id: string, data: Partial<any>) {
    try {
      const idLine = Number(id);
      if (!Number.isInteger(idLine) || idLine <= 0) {
        throw new Error('id invalide');
      }

      const updatePayload: Record<string, unknown> = {};
      if (typeof data.titre_poste === 'string') {
        updatePayload['Titre du poste'] = data.titre_poste;
      }
      if (typeof data.exigences === 'string') {
        updatePayload.Exigences = data.exigences;
      }
      if (typeof data.societe === 'string') {
        updatePayload['Sociéte'] = data.societe;
        updatePayload['Société'] = data.societe;
      }

      const { data: offre, error } = await this.supabase
        .from('post')
        .update(updatePayload)
        .eq('id_line', idLine)
        .select();

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        success: true,
        data: offre?.[0]
          ? {
              id: String(offre[0].id_line ?? offre[0].id),
              id_line: offre[0].id_line,
              societe_id: offre[0].id,
              titre_poste: offre[0]['Titre du poste'] ?? offre[0]['titre_poste'] ?? '',
              societe: offre[0]['Sociéte'] ?? offre[0]['Société'] ?? offre[0]['Societe'] ?? offre[0]['societe'] ?? '',
              exigences: offre[0].Exigences ?? offre[0]['exigences'] ?? '',
              date_creation: offre[0].date_creation ?? new Date().toISOString(),
            }
          : null,
        message: 'Offre mise à jour avec succès',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la mise à jour',
        data: null,
      };
    }
  }

  async deleteOffre(id: string) {
    try {
      const idLine = Number(id);
      if (!Number.isInteger(idLine) || idLine <= 0) {
        throw new Error('id invalide');
      }

      const { error } = await this.supabase
        .from('post')
        .delete()
        .eq('id_line', idLine);

      if (error) {
        throw new Error(`Supabase error: ${error.message}`);
      }

      return {
        success: true,
        message: 'Offre supprimée avec succès',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur lors de la suppression',
      };
    }
  }

  private async checkSocieteExists(societeId: number): Promise<boolean> {
    const tableCandidates = ['Societe', 'societe'];

    for (const tableName of tableCandidates) {
      const { data, error } = await this.supabase
        .from(tableName)
        .select('id')
        .eq('id', societeId)
        .maybeSingle();

      if (error) {
        const message = error.message.toLowerCase();
        const tableMissing = message.includes('relation') && message.includes('does not exist');
        if (tableMissing) {
          continue;
        }
        throw new Error(`Supabase error: ${error.message}`);
      }

      if (data?.id !== undefined && data?.id !== null) {
        return true;
      }
    }

    return false;
  }

  private async insertPostWithColumnFallbacks(input: {
    societeId: number;
    titre_poste: string;
    exigences: string;
    societe: string;
  }): Promise<any> {
    const titleColumns = ['Titre du poste', 'titre_poste'];
    const exigencesColumns = ['Exigences', 'exigences'];
    const societeColumns = ['Sociéte', 'Société', 'Societe', 'societe'];
    let lastError: Error | null = null;

    for (const titleCol of titleColumns) {
      for (const exigCol of exigencesColumns) {
        for (const socCol of societeColumns) {
          const payload: Record<string, unknown> = {
            id: input.societeId,
            [titleCol]: input.titre_poste,
            [exigCol]: input.exigences,
            [socCol]: input.societe,
            date_creation: new Date().toISOString(),
          };

          const { data, error } = await this.supabase
            .from('post')
            .insert([payload])
            .select('*')
            .single();

          if (!error) {
            return data;
          }

          lastError = new Error(`Supabase error: ${error.message}`);
          const msg = error.message.toLowerCase();
          const columnError = msg.includes('column') || msg.includes('schema cache') || msg.includes('does not exist');
          if (!columnError) {
            throw lastError;
          }
        }
      }
    }

    throw lastError ?? new Error('Supabase error: insert impossible sur la table post');
  }
}
