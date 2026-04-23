import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export type RecommendationStatus = 'pending' | 'approved' | 'rejected' | 'edited';

export interface Recommendation {
  id: string;
  status: RecommendationStatus;
  category: 'TARGET_METIER' | 'OTHER_METIER' | string;
  level: 'CRITIQUE' | 'HAUTE' | 'MOYENNE' | 'FAIBLE' | string;
  metier: string;
  metier_id?: string | null;
  domaine?: string | null;
  competence_name?: string | null;
  competence_type?: string | null;
  keywords?: string[] | null;
  gap_label?: string | null;
  gap_title?: string | null;
  concern_rate?: number | null;
  students_impacted?: number | null;
  cohort_size?: number | null;
  total_students?: number | null;
  popularity_rank?: number | null;
  llm_recommendation?: string | null;
  cert_title?: string | null;
  cert_description?: string | null;
  cert_provider?: string | null;
  cert_duration?: string | null;
  cert_pricing?: string | null;
  cert_url?: string | null;
  rag_sources?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RecommendationJob {
  id: string;
  status: 'running' | 'succeeded' | 'failed';
  triggered_by?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  error?: string | null;
  stats?: Record<string, any> | null;
}

type ApiEnvelope<T> = { success: boolean; message: string; data: T };

@Injectable({ providedIn: 'root' })
export class ValidationAdminService {
  private readonly base = `${environment.apiUrl}/admin/recommendations`;

  constructor(private readonly http: HttpClient) {}

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

  trigger(): Promise<{ jobId: string; status: string }> {
    return firstValueFrom(
      this.http.post<ApiEnvelope<{ jobId: string; status: string }>>(
        `${this.base}/generate`,
        {},
        { headers: this.authHeaders() },
      ),
    ).then((r) => this.unwrap(r));
  }

  getJob(jobId: string): Promise<RecommendationJob> {
    return firstValueFrom(
      this.http.get<ApiEnvelope<RecommendationJob>>(`${this.base}/jobs/${jobId}`, {
        headers: this.authHeaders(),
      }),
    ).then((r) => this.unwrap(r));
  }

  listJobs(): Promise<RecommendationJob[]> {
    return firstValueFrom(
      this.http.get<ApiEnvelope<{ jobs: RecommendationJob[] }>>(`${this.base}/jobs`, {
        headers: this.authHeaders(),
      }),
    ).then((r) => this.unwrap(r).jobs ?? []);
  }

  list(status?: string): Promise<Recommendation[]> {
    const url = status ? `${this.base}?status=${encodeURIComponent(status)}` : this.base;
    return firstValueFrom(
      this.http.get<ApiEnvelope<{ items: Recommendation[] }>>(url, { headers: this.authHeaders() }),
    ).then((r) => this.unwrap(r).items ?? []);
  }

  update(id: string, patch: Partial<Recommendation>): Promise<Recommendation> {
    return firstValueFrom(
      this.http.patch<ApiEnvelope<Recommendation>>(`${this.base}/${id}`, patch, {
        headers: this.authHeaders(),
      }),
    ).then((r) => this.unwrap(r));
  }

  approve(id: string, comment?: string): Promise<Recommendation> {
    return firstValueFrom(
      this.http.post<ApiEnvelope<Recommendation>>(
        `${this.base}/${id}/approve`,
        { comment: comment ?? '' },
        { headers: this.authHeaders() },
      ),
    ).then((r) => this.unwrap(r));
  }

  reject(id: string, comment?: string): Promise<{ ok: boolean }> {
    return firstValueFrom(
      this.http.post<ApiEnvelope<{ ok: boolean }>>(
        `${this.base}/${id}/reject`,
        { comment: comment ?? '' },
        { headers: this.authHeaders() },
      ),
    ).then((r) => this.unwrap(r));
  }
}
