import { Injectable } from '@angular/core';
import { environment } from '../../../../../environments/environment';

export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'deleted';

export type RecommendationRow = {
  id: string;
  rank_position: number;
  competence_name: string;
  metier_name: string;
  domaine_name: string;
  competence_type: string;
  keywords: string;
  pct_gap: number;
  n_gap: number;
  priority: string;
  recommended_certification: string;
  recommendation_text: string;
  status: RecommendationStatus;
  admin_note: string | null;
  source_collection: string;
  updated_at: string;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

@Injectable({
  providedIn: 'root',
})
export class RecommendationAiAdminApiService {
  private readonly baseUrl = `${environment.apiUrl}/recommendations`;

  private getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('AUTH_REQUIRED');
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  private async parseJson<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const json = raw ? (JSON.parse(raw) as ApiResponse<T>) : {};

    if (!response.ok) {
      throw new Error(json?.message || `API error ${response.status}`);
    }

    return (json?.data ?? json) as T;
  }

  async list(status?: RecommendationStatus): Promise<RecommendationRow[]> {
    const query = status ? `?${new URLSearchParams({ status }).toString()}` : '';
    const response = await fetch(`${this.baseUrl}${query}`, {
      method: 'GET',
      headers: {
        ...this.getAuthHeader(),
      },
    });

    return await this.parseJson<RecommendationRow[]>(response);
  }

  async generate(payload: {
    gapMinPct?: number;
    topK?: number;
    maxItems?: number;
    ragCollection?: string;
    useLlm?: boolean;
  }): Promise<{ generated: number; significantGaps: number; totalStudents: number; collection: string }> {
    const response = await fetch(`${this.baseUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    return await this.parseJson<{ generated: number; significantGaps: number; totalStudents: number; collection: string }>(response);
  }

  async update(
    id: string,
    payload: {
      recommendedCertification?: string;
      recommendationText?: string;
      status?: RecommendationStatus;
      adminNote?: string;
    },
  ): Promise<RecommendationRow> {
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    return await this.parseJson<RecommendationRow>(response);
  }

  async remove(id: string, hardDelete = false): Promise<void> {
    const query = `?${new URLSearchParams({ hard: String(hardDelete) }).toString()}`;
    const response = await fetch(`${this.baseUrl}/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
      headers: {
        ...this.getAuthHeader(),
      },
    });

    await this.parseJson<unknown>(response);
  }
}
