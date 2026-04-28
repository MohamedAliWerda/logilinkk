import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private http: HttpClient) {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
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
}
