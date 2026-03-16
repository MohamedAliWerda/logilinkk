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

@Component({
  selector: 'app-recommendation',
  imports: [CommonModule],
  templateUrl: './recommendation.html',
  styleUrl: './recommendation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommendation {
  readonly recommendedFormations: Formation[] = [
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
    {
      priority: 'Priorité moyenne',
      tone: 'medium',
      title: 'Lean Six Sigma - Green Belt',
      source: 'edX',
      duration: '6 semaines',
      description: 'Amélioration continue dans la supply chain',
    },
    {
      priority: 'Priorité moyenne',
      tone: 'medium',
      title: 'Commerce international avancé',
      source: 'ISGI',
      duration: 'Semestre 6',
      description: 'Prérequis pour spécialisation TI',
    },
    {
      priority: 'Optionnelle',
      tone: 'optional',
      title: 'Management interculturel',
      source: 'OpenClassrooms',
      duration: '2 semaines',
      description: "Soft skill valorisée à l'international",
    },
  ];
}
