import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;

  constructor(private http: HttpClient) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    this.supabaseAdmin = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey);
  }

  public get client() {
    return this.supabase;
  }

  public get adminClient() {
    return this.supabaseAdmin;
  }

  /**
   * Fetch all rows from the feedback table.
   * @param table optional table name (default: 'feedback')
   */
  async fetchFeedback(table = 'feedback') {
    if (table === 'ancien_etudiant' || table === 'feedback') {
      const route = table === 'feedback' ? 'feedback' : 'ancien-etudiants';
      const apiUrl = `${environment.apiUrl}/admin/${route}`;
      try {
        const response = await firstValueFrom(this.http.get<any>(apiUrl));
        const rows = Array.isArray(response) ? response : response?.data;
        if (Array.isArray(rows) && rows.length > 0) {
          return rows;
        }
      } catch {
        // fall through to Supabase anon client if the backend is unavailable
      }

      const { data, error } = await this.supabase.from('ancien_etudiant').select('*');
      if (error) {
        throw error;
      }
      return data;
    }

    const { data, error } = await this.supabase.from(table).select('*');
    if (error) {
      throw error;
    }
    return data;
  }

  async createAncienEtudiant(payload: Record<string, unknown>) {
    const apiUrl = `${environment.apiUrl}/admin/ancien-etudiants`;
    const response = await firstValueFrom(this.http.post<any>(apiUrl, payload));
    return Array.isArray(response) ? response[0] : response?.data ?? response;
  }

  async createFeedback(payload: Record<string, unknown>) {
    const apiUrl = `${environment.apiUrl}/admin/feedback`;
    const response = await firstValueFrom(this.http.post<any>(apiUrl, payload));
    return Array.isArray(response) ? response[0] : response?.data ?? response;
  }

  /**
   * Find a Societe by email + mot_de_passe. Returns the row or null.
   */
  async findSocieteByCredentials(email: string, motDePasse: string) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .select('*')
      .eq('email', email)
      .eq('mot_de_passe', motDePasse)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data ?? null;
  }

  async fetchSocietesBySituation(situation: string) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .select('*')
      .eq('situation', situation);

    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async fetchSocietesBySituations(situations: string[]) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .select('*')
      .in('situation', situations);

    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async fetchAllSocietes() {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .select('*');

    if (error) {
      throw error;
    }
    return data ?? [];
  }

  async updateSocieteSituation(id: number, situation: string) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .update({ situation })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw error;
    }
    return data ?? null;
  }

  async createSociete(payload: {
    nomEntreprise: string;
    email: string;
    telephone: string;
    adresse: string;
    description: string;
    password: string;
  }) {
    console.log('🟦 createSociete called with payload:', payload);
    console.log('🟦 Supabase URL:', environment.supabaseUrl);
    console.log('🟦 Admin client:', this.supabaseAdmin ? 'initialized' : 'NOT initialized');
    
    // Get the next sequential ID
    console.log('🟦 Fetching max ID from Societe...');
    const { data: maxIdData, error: maxIdError } = await this.supabaseAdmin
      .from('Societe')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    let nextId = 1;
    if (!maxIdError && maxIdData?.id) {
      nextId = (maxIdData.id as number) + 1;
    }
    console.log('🟦 Next ID to insert:', nextId);

    const row: Record<string, unknown> = {
      id: nextId,
      denomination_sociale: payload.nomEntreprise,
      email: payload.email,
      mot_de_passe: payload.password,
      telephone: payload.telephone,
      adresse: payload.adresse,
      secteur_activite: payload.description,
      situation: 'En attente',
      date_creation: new Date().toISOString(),
    };
    console.log('🟦 Row to insert:', row);

    const tableCandidates = ['Societe', 'societe'];
    let lastError: unknown;

    for (const tableName of tableCandidates) {
      try {
        console.log(`🟦 Trying table: ${tableName}`);
        console.log(`🟦 Executing: insert [${JSON.stringify(row)}] into ${tableName}`);
        const { data, error } = await this.supabaseAdmin
          .from(tableName)
          .insert([row])
          .select('id')
          .single();

        console.log(`🟦 Response received from ${tableName}`, { data, error });

        if (!error) {
          console.log(`🟩 Insert success in ${tableName}:`, data);
          return data;
        }

        lastError = error;
        console.log(`🟨 Insert error in ${tableName}:`, error);
        const message = String((error as any)?.message ?? '').toLowerCase();
        const tableMissing = message.includes('relation') && message.includes('does not exist');
        if (!tableMissing) {
          console.log(`🔴 Non-table-missing error, throwing:`, error);
          throw error;
        }
      } catch (err) {
        lastError = err;
        console.log(`🔴 Catch block error:`, err);
        const message = String((err as any)?.message ?? '').toLowerCase();
        const tableMissing = message.includes('relation') && message.includes('does not exist');
        if (!tableMissing) {
          console.log(`🔴 Non-table-missing error caught, throwing:`, err);
          throw err;
        }
      }
    }

    console.log(`🔴 All table attempts failed, throwing lastError:`, lastError);
    throw lastError;
  }
}
