import { Component, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

type Formation = {
  priority: string;
  tone: 'high' | 'medium' | 'optional';
  title: string;
  source: string;
  duration: string;
  description: string;
};

type Stage = {
  title: string;
  company: string;
  location: string;
  duration: string;
  deadline: string;
  tags: string[];
  match: number;
  applied?: boolean;
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

type StudentRecommendation = {
  id: string;
  level: 'CRITIQUE' | 'HAUTE' | 'MOYENNE';
  gapTitle: string;
  metier: string;
  llmRecommendation: string;
  certification: {
    title: string;
    provider: string;
    duration: string;
    pricing: string;
    description?: string;
  };
};

@Component({
  selector: 'app-recommendation',
  imports: [CommonModule],
  templateUrl: './recommendation.html',
  styleUrl: './recommendation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommendation {
  targetJobFormations: Formation[] = [
    {
      priority: 'Priorité haute',
      tone: 'high',
      title: 'SAP ERP - Module MM',
      source: 'SAP Learning Hub',
      duration: '4 semaines',
      description: 'Compétence requise par 85% des entreprises matchées',
    },
    {
      priority: 'Priorité haute',
      tone: 'high',
      title: 'Power BI pour la logistique',
      source: 'Coursera',
      duration: '3 semaines',
      description: 'Gap identifié dans Data Analytics',
    },
  ];

  generalFormations: Formation[] = [
    {
      priority: 'Priorité moyenne',
      tone: 'medium',
      title: 'Lean Six Sigma - Green Belt',
      source: 'edX',
      duration: '6 semaines',
      description: 'Amélioration continue dans la supply chain',
    },
    {
      priority: 'Optionnelle',
      tone: 'optional',
      title: 'Management interculturel',
      source: 'OpenClassrooms',
      duration: '2 semaines',
      description: "Soft skill valorisée à l'international",
    },
    {
      priority: 'Priorité moyenne',
      tone: 'medium',
      title: 'Commerce international avancé',
      source: 'ISGI',
      duration: 'Semestre 6',
      description: 'Prérequis pour spécialisation TI',
    },
  ];

  readonly recommendedStages: Stage[] = [
    {
      title: 'Stage - Assistant Supply Chain', company: 'Sotrapil', location: 'Casablanca', duration: '3 mois', deadline: '15 Avril 2026',
      tags: ['SAP', 'Excel', 'Planification'], match: 92, applied: false,
    },
    {
      title: 'Stage - Analyste Logistique', company: 'STAM', location: 'Tanger', duration: '4 mois', deadline: '30 Mars 2026',
      tags: ['Power BI', 'Python', 'Reporting'], match: 87, applied: false,
    },
    {
      title: 'Stage - Coordinateur Transport', company: 'Marsa Maroc', location: 'Agadir', duration: '6 mois', deadline: '20 Mai 2026',
      tags: ['Transport', 'Opérations', 'Logistique'], match: 84, applied: false,
    },
  ];

  loadingRecommendations = false;
  recommendationError = '';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.loadConfirmedRecommendations();
  }

  applyStage(stage: Stage) {
    stage.applied = true;
  }

  private loadConfirmedRecommendations(): void {
    const authId = this.getCurrentAuthId();
    if (!authId) {
      return;
    }

    this.loadingRecommendations = true;
    this.recommendationError = '';

    this.http
      .get<ApiResponse<StudentRecommendation[]>>(
        `${environment.apiUrl}/admin/recommendations/students/${authId}/confirmed`,
      )
      .subscribe({
        next: (response) => {
          const rows = response?.data ?? [];
          if (rows.length > 0) {
            const mapped = rows.map((row) => this.mapRecommendationToFormation(row));
            this.targetJobFormations = mapped.slice(0, 4);
            this.generalFormations = mapped.slice(4);
          }

          this.loadingRecommendations = false;
        },
        error: () => {
          this.loadingRecommendations = false;
          this.recommendationError =
            'Impossible de charger les recommandations confirmees.';
        },
      });
  }

  private mapRecommendationToFormation(row: StudentRecommendation): Formation {
    return {
      priority: this.getPriorityLabel(row.level),
      tone: this.getTone(row.level),
      title: row.certification.title,
      source: row.certification.provider,
      duration: row.certification.duration,
      description:
        row.certification.description?.trim() ||
        `Gap cible: ${row.gapTitle} (${row.metier})`,
    };
  }

  private getPriorityLabel(level: StudentRecommendation['level']): string {
    if (level === 'CRITIQUE') return 'Priorite haute';
    if (level === 'HAUTE') return 'Priorite moyenne';
    return 'Optionnelle';
  }

  private getTone(level: StudentRecommendation['level']): Formation['tone'] {
    if (level === 'CRITIQUE') return 'high';
    if (level === 'HAUTE') return 'medium';
    return 'optional';
  }

  private getCurrentAuthId(): string | null {
    const rawUser = localStorage.getItem('user');
    if (!rawUser) {
      return null;
    }

    try {
      const user = JSON.parse(rawUser) as { id?: string };
      const id = String(user?.id ?? '').trim();
      return id.length > 0 ? id : null;
    } catch {
      return null;
    }
  }
}

