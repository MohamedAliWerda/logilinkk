import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../../environments/environment';

export interface CvPayload {
  professionalTitle: string;
  metierId?: string;
  specialization: string;
  objectif: string;
  atsScore: number;
  consentGiven: boolean;
  info: {
    permis: string;
    linkedin: string;
    dateNaissance: string;
    photoUrl?: string;
  };
  formations: any[];
  experiences: any[];
  hardSkills: any[];
  softSkills: any[];
  langues: any[];
  projets: any[];
  certifications: any[];
  engagements: any[];
}

export interface AtsScoreResponse {
  matchScore: number;
  successScore: number;
  atsScore: number;
  rawResponse?: string;
}

@Injectable({ providedIn: 'root' })
export class CvSubmissionService {
  private supabase: SupabaseClient;
  private readonly cvExistsCacheKey = 'cv_exists_cached';
  private readonly cvExistsCachedAtKey = 'cv_exists_cached_at';
  private readonly cvExistsCachedUserKey = 'cv_exists_cached_user';
  private readonly cvExistsCacheTtlMs = 1000 * 60 * 60 * 24 * 30;
  private cvFetchInFlight: Promise<any | null> | null = null;
  private cvFetchInFlightKey: string | null = null;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  private getCurrentCacheUser(): string {
    try {
      const rawUser = localStorage.getItem('user');
      if (rawUser) {
        const user = JSON.parse(rawUser) as Record<string, any>;
        const candidate =
          user?.['auth_id']
          ?? user?.['id']
          ?? user?.['userId']
          ?? user?.['cin_passport']
          ?? user?.['email'];

        if (candidate !== undefined && candidate !== null) {
          const normalized = String(candidate).trim();
          if (normalized.length > 0) {
            return normalized;
          }
        }
      }
    } catch {
      // ignore user parse/storage errors
    }

    const token = localStorage.getItem('token');
    if (token && token.length > 0) {
      return `token:${token.slice(0, 24)}`;
    }

    return 'anonymous';
  }

  private setCvExistsCache(exists: boolean): void {
    try {
      if (exists) {
        localStorage.setItem(this.cvExistsCacheKey, '1');
        localStorage.setItem(this.cvExistsCachedAtKey, String(Date.now()));
        localStorage.setItem(this.cvExistsCachedUserKey, this.getCurrentCacheUser());
        return;
      }

      localStorage.removeItem(this.cvExistsCacheKey);
      localStorage.removeItem(this.cvExistsCachedAtKey);
      localStorage.removeItem(this.cvExistsCachedUserKey);
    } catch {
      // ignore localStorage failures
    }
  }

  hasCachedCv(): boolean {
    try {
      if (localStorage.getItem(this.cvExistsCacheKey) !== '1') {
        return false;
      }

      const cachedUser = localStorage.getItem(this.cvExistsCachedUserKey);
      const currentUser = this.getCurrentCacheUser();
      if (!cachedUser || cachedUser !== currentUser) {
        this.setCvExistsCache(false);
        return false;
      }

      const rawTs = localStorage.getItem(this.cvExistsCachedAtKey);
      const ts = Number(rawTs);
      if (!Number.isFinite(ts)) {
        this.setCvExistsCache(false);
        return false;
      }

      const isFresh = (Date.now() - ts) < this.cvExistsCacheTtlMs;
      if (!isFresh) {
        this.setCvExistsCache(false);
      }

      return isFresh;
    } catch {
      return false;
    }
  }

  isAuthRequiredError(error: unknown): boolean {
    const message = String((error as any)?.message ?? '');
    return message.includes('AUTH_REQUIRED');
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const sessionRes = await this.supabase.auth.getSession();
      let token = sessionRes?.data?.session?.access_token;
      if (!token) {
        token = localStorage.getItem('token') ?? undefined;
      }
      return token ?? null;
    } catch {
      return localStorage.getItem('token');
    }
  }

  async upsertCv(payload: CvPayload): Promise<void> {
    try {
      // try server-side endpoint first
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('AUTH_REQUIRED');
      }

      const resp = await fetch(`${environment.apiUrl}/cv-submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const text = await resp.text();
        const message = `Server CV save failed (${resp.status}): ${text}`;
        if (resp.status === 401 || resp.status === 403) {
          throw new Error(`AUTH_REQUIRED: ${message}`);
        }
        console.error(message);
        throw new Error(message);
      }

      this.setCvExistsCache(true);
    } catch (err) {
      console.error('CvSubmissionService.upsertCv error', err);
      throw err;
    }
  }

  async calculateAtsScore(payload: CvPayload): Promise<AtsScoreResponse> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('Utilisateur non authentifie.');
    }

    const resp = await fetch(`${environment.apiUrl}/cv-submissions/ats-score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`ATS score API failed (${resp.status}): ${text}`);
    }

    const json = await resp.json();
    const data = json?.data ?? json;

    const clamp = (value: any) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return 0;
      return Math.max(0, Math.min(100, Math.round(n)));
    };

    return {
      matchScore: clamp(data?.matchScore),
      successScore: clamp(data?.successScore),
      atsScore: clamp(data?.atsScore),
      rawResponse: typeof data?.rawResponse === 'string' ? data.rawResponse : undefined,
    };
  }

  async fetchMyCv(metierId?: string): Promise<any | null> {
    const normalizedMetierId = String(metierId ?? '').trim();
    const requestKey = normalizedMetierId.length > 0 ? normalizedMetierId : '__default__';

    if (this.cvFetchInFlight && this.cvFetchInFlightKey === requestKey) {
      return this.cvFetchInFlight;
    }

    this.cvFetchInFlightKey = requestKey;
    this.cvFetchInFlight = this.fetchMyCvFromApi(normalizedMetierId);
    try {
      return await this.cvFetchInFlight;
    } finally {
      this.cvFetchInFlight = null;
      this.cvFetchInFlightKey = null;
    }
  }

  private async fetchMyCvFromApi(metierId?: string): Promise<any | null> {
    const token = await this.getAuthToken();
    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }

    const normalizedMetierId = String(metierId ?? '').trim();
    const query = normalizedMetierId.length > 0
      ? `?${new URLSearchParams({ metierId: normalizedMetierId }).toString()}`
      : '';

    const resp = await fetch(`${environment.apiUrl}/cv-submissions/me${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (resp.status === 401 || resp.status === 403) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!resp.ok) {
      throw new Error(`CV_FETCH_FAILED_${resp.status}`);
    }

    const json = await resp.json();
    const data = json?.data ?? json;
    if (!data?.found) {
      this.setCvExistsCache(false);
      return null;
    }

    this.setCvExistsCache(true);
    return data.cv ?? null;
  }

  async fetchExtractedSkills(metierId?: string): Promise<{
    found: boolean;
    hardSkills: Array<{ type: string; nom: string; niveau: string }>;
    softSkills: Array<{ nom: string; niveau: string; contexte: string }>;
  }> {
    const token = await this.getAuthToken();
    const normalizedMetierId = String(metierId ?? '').trim();
    if (!token || !normalizedMetierId) return { found: false, hardSkills: [], softSkills: [] };

    try {
      const params = new URLSearchParams({ metierId: normalizedMetierId });
      const resp = await fetch(`${environment.apiUrl}/cv-submissions/extract-skills?${params.toString()}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return { found: false, hardSkills: [], softSkills: [] };

      const json = await resp.json();
      const data = json?.data ?? json;
      return {
        found: !!data?.found,
        hardSkills: Array.isArray(data?.hardSkills) ? data.hardSkills : [],
        softSkills: Array.isArray(data?.softSkills) ? data.softSkills : [],
      };
    } catch (err) {
      console.error('fetchExtractedSkills error', err);
      return { found: false, hardSkills: [], softSkills: [] };
    }
  }

  async fetchMetiers(): Promise<any[]> {
    try {
      const resp = await fetch(`${environment.apiUrl}/ref-competance/metiers`);
      if (!resp.ok) return [];
      const json = await resp.json();
      return json?.data ?? [];
    } catch (err) {
      console.error('fetchMetiers error', err);
      return [];
    }
  }

  async fetchDomaines(): Promise<any[]> {
    try {
      const resp = await fetch(`${environment.apiUrl}/ref-competance/domaines`);
      if (!resp.ok) return [];
      const json = await resp.json();
      return json?.data ?? [];
    } catch (err) {
      console.error('fetchDomaines error', err);
      return [];
    }
  }
}
