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

@Injectable({ providedIn: 'root' })
export class CvSubmissionService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
  }

  async upsertCv(payload: CvPayload): Promise<void> {
    try {
      // try server-side endpoint first
      const sessionRes = await this.supabase.auth.getSession();
      let token = sessionRes?.data?.session?.access_token;
      if (!token) {
        token = localStorage.getItem('token') ?? undefined;
      }
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
}
