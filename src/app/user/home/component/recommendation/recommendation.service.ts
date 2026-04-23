import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export interface StudentRecommendation {
  id: string;
  status: string;
  level?: string | null;
  category?: string | null;
  metier?: string | null;
  domaine?: string | null;
  competence_name?: string | null;
  competence_type?: string | null;
  keywords?: string[] | null;
  gap_label?: string | null;
  gap_title?: string | null;
  concern_rate?: number | null;
  students_impacted?: number | null;
  cohort_size?: number | null;
  popularity_rank?: number | null;
  llm_recommendation?: string | null;
  cert_title?: string | null;
  cert_description?: string | null;
  cert_provider?: string | null;
  cert_duration?: string | null;
  cert_pricing?: string | null;
  cert_url?: string | null;
  updated_at?: string | null;
}

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

@Injectable({ providedIn: 'root' })
export class RecommendationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/recommendations`;

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token') ?? '';
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  private unwrap<T>(res: ApiEnvelope<T> | T): T {
    const envelope = res as ApiEnvelope<T>;
    if (envelope && typeof envelope === 'object' && 'data' in envelope && 'success' in envelope) {
      return envelope.data;
    }
    return res as T;
  }

  async listApprovedForStudent(): Promise<StudentRecommendation[]> {
    const response = await firstValueFrom(
      this.http.get<ApiEnvelope<{ items?: StudentRecommendation[] }> | { items?: StudentRecommendation[] }>(
        `${this.baseUrl}/approved`, {
        headers: this.authHeaders(),
      }),
    );

    const payload = this.unwrap(response);
    if (!Array.isArray(payload?.items)) {
      return [];
    }

    return payload.items;
  }
}
