import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, timeout } from 'rxjs/operators';

export interface CompanyCandidature {
  id: string;
  id_etudiant: number;
  id_societe: number;
  id_post: number;
  poste: string;
  nom: string;
  prenom: string;
  email: string;
  ville: string;
  score_employabilite: number;
  score_ats: number | null;
  date_creation: string;
  competences: string[];
}

@Injectable({
  providedIn: 'root',
})
export class CandidaturesService {
  private readonly apiUrl = 'http://localhost:3001/offres';

  constructor(private readonly http: HttpClient) {}

  fetchCompanyCandidatures(): Observable<CompanyCandidature[]> {
    const societeId = this.getSocieteIdFromStorage();
    if (!societeId) {
      return throwError(() => new Error('Compte societe introuvable. Veuillez vous reconnecter.'));
    }

    return this.http.get<any>(`${this.apiUrl}/company/${societeId}/candidatures`).pipe(
      timeout(15000),
      map((response) => {
        const normalized = this.normalizeResponse(response);
        if (!normalized.success) {
          throw new Error(normalized.error || 'Erreur lors du chargement des candidatures');
        }
        return Array.isArray(normalized.data) ? normalized.data : [];
      }),
      catchError((error) => {
        const timeoutError = error?.name === 'TimeoutError';
        const errorMsg = timeoutError
          ? 'Le chargement des candidatures a depasse le delai. Veuillez reessayer.'
          : (error?.error?.error || error?.message || 'Erreur lors du chargement des candidatures');
        return throwError(() => new Error(errorMsg));
      }),
    );
  }

  private getSocieteIdFromStorage(): number | undefined {
    try {
      const entrepriseRaw = localStorage.getItem('entreprise');
      if (!entrepriseRaw) {
        return undefined;
      }

      const entreprise = JSON.parse(entrepriseRaw);
      const societeId = Number(entreprise?.id);
      if (!Number.isInteger(societeId) || societeId <= 0) {
        return undefined;
      }

      return societeId;
    } catch {
      return undefined;
    }
  }

  private normalizeResponse(response: any): {
    success: boolean;
    data: any;
    error?: string;
  } {
    if (response && response.success === true && Array.isArray(response.data)) {
      return {
        success: true,
        data: response.data,
      };
    }

    if (response && response.success === true && response.data && typeof response.data === 'object') {
      if ('success' in response.data) {
        return {
          success: response.data.success !== false,
          data: response.data.data,
          error: response.data.error,
        };
      }
    }

    if (response && response.success === false) {
      return {
        success: false,
        data: null,
        error: response.error || 'Erreur API',
      };
    }

    return {
      success: false,
      data: null,
      error: 'Reponse API invalide',
    };
  }
}
