import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../../../environments/environment';

export interface CvPayload {
  professionalTitle: string;
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

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
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
        console.warn('CvSubmissionService.upsertCv: no authenticated user; skipping save');
        return;
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
        console.error('Server CV save failed', resp.status, text);
      }
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

  async fetchMyCv(): Promise<any | null> {
    const token = await this.getAuthToken();
    if (!token) return null;

    const resp = await fetch(`${environment.apiUrl}/cv-submissions/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!resp.ok) return null;

    const json = await resp.json();
    const data = json?.data ?? json;
    if (!data?.found) {
      return null;
    }
    return data.cv ?? null;
  }

  async fetchExtractedSkills(): Promise<{
    found: boolean;
    hardSkills: Array<{ type: string; nom: string; niveau: string }>;
    softSkills: Array<{ nom: string; niveau: string; contexte: string }>;
  }> {
    const token = await this.getAuthToken();
    if (!token) return { found: false, hardSkills: [], softSkills: [] };

    try {
      const resp = await fetch(`${environment.apiUrl}/cv-submissions/extract-skills`, {
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
