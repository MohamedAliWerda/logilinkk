import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { environment } from '../../../../../environments/environment';

export type RecommendationLevel = 'CRITIQUE' | 'HAUTE' | 'MOYENNE';
export type RecommendationStatus = 'PENDING' | 'CONFIRMED' | 'DELETED';

export type CertificationPayload = {
  title: string;
  description?: string;
  provider: string;
  duration: string;
  pricing: string;
  url?: string;
};

export type RecommendationItem = {
  id: string;
  category: string;
  gapLabel: string;
  gapTitle: string;
  level: RecommendationLevel;
  metier: string;
  keywords: string[];
  concernRate: number;
  studentsImpacted: number;
  totalStudents: number;
  llmRecommendation: string;
  certification: CertificationPayload;
  status: RecommendationStatus;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  message?: string;
};

@Injectable({
  providedIn: 'root',
})
export class RagRecommendationApiService {
  private readonly apiBaseUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  getRecommendations(): Observable<RecommendationItem[]> {
    return this.http
      .get<ApiResponse<RecommendationItem[]>>(
        `${this.apiBaseUrl}/admin/recommendations/ai-certifications`,
      )
      .pipe(
        map((response) => response?.data ?? []),
        catchError(() => of(this.getFallbackRecommendations())),
      );
  }

  generateRecommendations(): Observable<RecommendationItem[]> {
    return this.http
      .post<ApiResponse<RecommendationItem[]>>(
        `${this.apiBaseUrl}/admin/recommendations/ai-certifications/generate`,
        {},
      )
      .pipe(
        map((response) => response?.data ?? []),
        catchError(() => of([])),
      );
  }

  updateCertification(
    id: string,
    certification: CertificationPayload,
  ): Observable<boolean> {
    return this.http
      .put<ApiResponse<unknown>>(
        `${this.apiBaseUrl}/admin/recommendations/ai-certifications/${id}`,
        { certification },
      )
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  confirmRecommendation(id: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<unknown>>(
        `${this.apiBaseUrl}/admin/recommendations/ai-certifications/${id}/confirm`,
        {},
      )
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  deleteRecommendation(id: string): Observable<boolean> {
    return this.http
      .delete<ApiResponse<unknown>>(
        `${this.apiBaseUrl}/admin/recommendations/ai-certifications/${id}`,
      )
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }

  private getFallbackRecommendations(): RecommendationItem[] {
    return [
      {
        id: 'rec-001',
        category: '2. MANIPULER',
        gapLabel: 'Comportementale',
        gapTitle: 'Adopter dynamisme, rigueur et honnetete (integrite stock)',
        level: 'CRITIQUE',
        metier: 'Preparateur de commandes',
        keywords: ['integrite', 'rigueur'],
        concernRate: 100,
        studentsImpacted: 30,
        totalStudents: 30,
        llmRecommendation:
          'La totalite de la promotion est concernee par ce gap. La certification proposee est orientee vers la maitrise des KPI logistiques et le suivi rigoureux des donnees de stock.',
        certification: {
          title: 'Supply Chain Analytics',
          description: 'Parcours axe sur les KPI logistiques, le controle des flux et la fiabilite des donnees de stock.',
          provider: 'Coursera',
          duration: '20h',
          pricing: 'Gratuit (audit)',
          url: '',
        },
        status: 'PENDING',
      },
      {
        id: 'rec-002',
        category: '4. PLANIFIER & COORDONNER',
        gapLabel: 'Technique',
        gapTitle: 'Appliquer les methodes FIFO/ABC et analyser la rotation des stocks',
        level: 'CRITIQUE',
        metier: 'Gestionnaire de Stocks',
        keywords: ['FIFO', 'ABC'],
        concernRate: 100,
        studentsImpacted: 30,
        totalStudents: 30,
        llmRecommendation:
          'Le gap est prioritaire et impacte tout le groupe. Une certification orientee analyse de flux et pilotage de stock est recommandee pour une correction rapide.',
        certification: {
          title: 'Inventory Management Foundations',
          description: 'Formation orientee FIFO/ABC et rotation des stocks avec cas pratiques de pilotage operationnel.',
          provider: 'LinkedIn Learning',
          duration: '12h',
          pricing: 'Abonnement',
          url: '',
        },
        status: 'PENDING',
      },
      {
        id: 'rec-003',
        category: '6. PILOTER LA QUALITE',
        gapLabel: 'Organisationnelle',
        gapTitle: 'Mettre en place les routines de controle qualite en entrepot',
        level: 'HAUTE',
        metier: 'Responsable exploitation logistique',
        keywords: ['qualite', 'controle'],
        concernRate: 64,
        studentsImpacted: 16,
        totalStudents: 25,
        llmRecommendation:
          'Le gap peut etre reduit via un parcours court centre sur standards operationnels, checklist qualite et suivi d incidents.',
        certification: {
          title: 'Lean Six Sigma Yellow Belt',
          description: 'Introduction aux standards qualite et aux routines de resolution des ecarts en entrepot.',
          provider: 'Udemy',
          duration: '9h',
          pricing: 'Payant',
          url: '',
        },
        status: 'PENDING',
      },
    ];
  }
}
