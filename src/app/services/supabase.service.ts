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

  async checkSocieteEmailExists(email: string): Promise<boolean> {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw error;
    }
    return data !== null;
  }

  /**
   * Check for an existing Societe matching any of the main identity fields.
   * Returns the first conflicting row found (id + fields) or null.
   */
  async findConflictingSociete(payload: {
    nomEntreprise?: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    description?: string;
  }) {
    // Perform safe, per-column checks to avoid building a raw OR expression
    // which can break when values contain commas, spaces or special chars.
    if (payload.email) {
      // case-insensitive match
      const { data, error } = await this.supabaseAdmin
        .from('Societe')
        .select('id,denomination_sociale,email,telephone,adresse,secteur_activite')
        .ilike('email', payload.email)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) return data[0];
    }

    if (payload.telephone) {
      const { data, error } = await this.supabaseAdmin
        .from('Societe')
        .select('id,denomination_sociale,email,telephone,adresse,secteur_activite')
        .eq('telephone', payload.telephone)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) return data[0];
    }

    if (payload.nomEntreprise) {
      // case-insensitive match for company name
      const { data, error } = await this.supabaseAdmin
        .from('Societe')
        .select('id,denomination_sociale,email,telephone,adresse,secteur_activite')
        .ilike('denomination_sociale', payload.nomEntreprise)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) return data[0];
    }

    if (payload.adresse) {
      // case-insensitive address match
      const { data, error } = await this.supabaseAdmin
        .from('Societe')
        .select('id,denomination_sociale,email,telephone,adresse,secteur_activite')
        .ilike('adresse', payload.adresse)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) return data[0];
    }

    if (payload.description) {
      // case-insensitive sector match
      const { data, error } = await this.supabaseAdmin
        .from('Societe')
        .select('id,denomination_sociale,email,telephone,adresse,secteur_activite')
        .ilike('secteur_activite', payload.description)
        .limit(1);
      if (error) throw error;
      if (data && data.length > 0) return data[0];
    }

    return null;
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

  async fetchSocieteById(id: number) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  }

  async updateSocieteProfile(
    id: number,
    payload: {
      nomEntreprise: string;
      email: string;
      telephone: string;
      adresse: string;
      description: string;
    },
  ) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .update({
        denomination_sociale: payload.nomEntreprise,
        email: payload.email,
        telephone: payload.telephone,
        adresse: payload.adresse,
        secteur_activite: payload.description,
      })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ?? null;
  }

  async fetchCompanyPosts(societeId: number) {
    const apiUrl = `${environment.apiUrl}/offres/company/${societeId}`;
    const response = await firstValueFrom(this.http.get<any>(apiUrl));

    if (Array.isArray(response)) {
      return response;
    }

    if (Array.isArray(response?.data)) {
      return response.data;
    }

    if (Array.isArray(response?.data?.data)) {
      return response.data.data;
    }

    return [];
  }

  async fetchCompanyPostCounts(societeIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    const validIds = [...new Set((societeIds || []).filter((id) => Number.isInteger(id) && id > 0))];

    for (const id of validIds) {
      counts.set(id, 0);
    }

    if (!validIds.length) {
      return counts;
    }

    const { data, error } = await this.supabaseAdmin
      .from('post')
      .select('id')
      .in('id', validIds);

    if (error) {
      throw error;
    }

    const rows = Array.isArray(data) ? data : [];
    for (const row of rows) {
      const societeId = Number((row as any)?.id ?? 0);
      if (!Number.isInteger(societeId) || societeId <= 0) continue;
      counts.set(societeId, (counts.get(societeId) ?? 0) + 1);
    }

    return counts;
  }

  async updateSocieteSituation(id: number, situation: string) {
    const { data, error } = await this.supabaseAdmin
      .from('Societe')
      .update({ situation })
      .eq('id', id)
      .select('*')
      .maybeSingle();

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
    const { data: maxIdDataArray, error: maxIdError } = await this.supabaseAdmin
      .from('Societe')
      .select('id')
      .order('id', { ascending: false })
      .limit(1);

    let nextId = 1;
    if (!maxIdError && maxIdDataArray && maxIdDataArray.length > 0) {
      nextId = ((maxIdDataArray[0] as any)?.id as number) + 1;
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
          .maybeSingle();

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
