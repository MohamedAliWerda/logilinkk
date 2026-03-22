import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

type CompetencySource = 'market' | 'internal';

type Competency = {
  id: string;
  nameFr: string;
  domain: string;
  importanceWeight: number;
  source: CompetencySource;
};

type Formation = {
  id: string;
  nameFr: string;
  competencyIds: string[];
};

type JobProfile = {
  id: string;
  nameFr: string;
  category: 'transport' | 'logistique' | 'supply';
};

@Component({
  selector: 'app-matrice-admin',
  imports: [CommonModule],
  templateUrl: './matrice_admin.html',
  styleUrl: './matrice_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatriceAdmin {
  readonly categoryLabels: Record<JobProfile['category'], string> = {
    transport: 'Transport',
    logistique: 'Logistique',
    supply: 'Supply Chain',
  };

  readonly competencies: Competency[] = [
    { id: 'c1', nameFr: "Gestion d'entrepôt WMS", domain: 'Digital', importanceWeight: 4.8, source: 'market' },
    { id: 'c2', nameFr: 'SAP/ERP Logistique', domain: 'Digital', importanceWeight: 4.7, source: 'market' },
    { id: 'c3', nameFr: 'Planification transport', domain: 'Operations', importanceWeight: 4.4, source: 'market' },
    { id: 'c4', nameFr: 'Power BI', domain: 'Data', importanceWeight: 4.2, source: 'market' },
    { id: 'c5', nameFr: 'Incoterms 2020', domain: 'Reglementaire', importanceWeight: 4.1, source: 'market' },
    { id: 'c6', nameFr: 'Optimisation des coûts', domain: 'Performance', importanceWeight: 4.0, source: 'market' },
    { id: 'c7', nameFr: 'Pilotage KPI supply', domain: 'Data', importanceWeight: 3.9, source: 'market' },
    { id: 'c8', nameFr: 'Lean logistique', domain: 'Performance', importanceWeight: 3.8, source: 'market' },
    { id: 'c9', nameFr: 'Transport multimodal', domain: 'Operations', importanceWeight: 3.6, source: 'market' },
    { id: 'c10', nameFr: 'Conformité douanière', domain: 'Reglementaire', importanceWeight: 3.5, source: 'market' },
    { id: 'c11', nameFr: 'Rédaction CV ATS', domain: 'Employabilite', importanceWeight: 3.1, source: 'internal' },
    { id: 'c12', nameFr: 'Communication professionnelle', domain: 'Soft skills', importanceWeight: 2.8, source: 'internal' },
  ];

  readonly formations: Formation[] = [
    { id: 'f1', nameFr: 'M1-S1 Supply Chain Management', competencyIds: ['c3', 'c6', 'c7'] },
    { id: 'f2', nameFr: 'Transport International et Incoterms', competencyIds: ['c5', 'c9', 'c10'] },
    { id: 'f3', nameFr: 'Pilotage Entrepôt et Flux', competencyIds: ['c6', 'c8'] },
    { id: 'f4', nameFr: 'Data Logistique et KPI', competencyIds: ['c7', 'c11'] },
    { id: 'f5', nameFr: 'Conduite des Operations Transport', competencyIds: ['c3', 'c9'] },
    { id: 'f6', nameFr: "Soft skills pour l'employabilité", competencyIds: ['c12', 'c11'] },
  ];

  readonly jobProfiles: JobProfile[] = [
    { id: 'j1', nameFr: 'Responsable Logistique', category: 'logistique' },
    { id: 'j2', nameFr: 'Exploitant Transport', category: 'transport' },
    { id: 'j3', nameFr: 'Analyste Supply Chain', category: 'supply' },
  ];

  readonly recommendations: string[] = [
    "Le module 'Gestion d'entrepôt WMS' n'est couvert par aucune formation actuelle mais est exigé dans 73 % des offres de Responsable Logistique.",
    "La compétence 'SAP/ERP Logistique' peut être intégrée au module M1-S1 Supply Chain Management pour renforcer l'employabilité de 85 % des étudiants.",
    "L'ajout d'un module Power BI augmenterait la couverture des compétences digitales demandées de 25 % à 60 %.",
  ];

  get topMarketComps(): Competency[] {
    return this.competencies
      .filter((competency) => competency.importanceWeight >= 3.5)
      .slice(0, 10);
  }

  get uncoveredCompetencies(): Competency[] {
    return this.competencies
      .filter(
        (competency) =>
          competency.source === 'market' && competency.importanceWeight >= 3.5
      )
      .filter(
        (competency) =>
          !this.formations.some((formation) =>
            formation.competencyIds.includes(competency.id)
          )
      );
  }

  isCovered(formation: Formation, competencyId: string): boolean {
    return formation.competencyIds.includes(competencyId);
  }

  trackByFormation(_: number, formation: Formation): string {
    return formation.id;
  }

  trackByCompetency(_: number, competency: Competency): string {
    return competency.id;
  }

  trackByRecommendation(_: number, recommendation: string): string {
    return recommendation;
  }
}
