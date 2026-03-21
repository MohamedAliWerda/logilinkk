import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

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

@Component({
  selector: 'app-recommendation',
  imports: [CommonModule],
  templateUrl: './recommendation.html',
  styleUrl: './recommendation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommendation {
  readonly targetJobFormations: Formation[] = [
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

  readonly generalFormations: Formation[] = [
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

  applyStage(stage: Stage) {
    stage.applied = true;
  }
}

