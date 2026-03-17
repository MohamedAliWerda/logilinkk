import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

type FormationCategory = 'internal' | 'external';

interface Formation {
  code: string;
  title: string;
  description: string;
  duration: string;
  students: number;
  semester: string;
  statut: 'En cours' | 'Planifie';
  category: FormationCategory;
}

@Component({
  selector: 'app-formations-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './formations_admin.html',
  styleUrl: './formations_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormationsAdmin {
  adminName = 'Nour';
  sidebarCollapsed = false;
  showAddForm = false;
  formError = '';
  readonly previewLimit = 9;
  showAllInternal = false;
  showAllExternal = false;
  readonly internalTitle = 'Formation interne et certifications dispenses a l\'ISGIS';
  readonly externalTitle = 'Formation externe et certifications specialisees';

  newFormation: Formation = this.emptyFormation();

  formations: Formation[] = [
    {
      code: 'LOG-101',
      title: 'Gestion de la chaine logistique',
      description: 'Principes fondamentaux de la gestion logistique, planification et optimisation des flux.',
      duration: '120h',
      students: 42,
      semester: 'S3',
      statut: 'En cours',
      category: 'internal',
    },
    {
      code: 'TRA-201',
      title: 'Transport international',
      description: 'Reglementations, incoterms, modes de transport et documentation internationale.',
      duration: '90h',
      students: 35,
      semester: 'S3',
      statut: 'En cours',
      category: 'internal',
    },
    {
      code: 'LOG-102',
      title: 'Gestion des stocks et approvisionnement',
      description: 'Methodes de gestion des stocks, calcul des points de commande et optimisation.',
      duration: '80h',
      students: 42,
      semester: 'S3',
      statut: 'En cours',
      category: 'internal',
    },
    {
      code: 'COM-301',
      title: 'Commerce international',
      description: 'Techniques du commerce international, negociation et contrats.',
      duration: '100h',
      students: 28,
      semester: 'S4',
      statut: 'En cours',
      category: 'internal',
    },
    {
      code: 'TRA-202',
      title: 'Douane et reglementation',
      description: "Procedures douanieres, tarifs et reglementations a l'import/export.",
      duration: '60h',
      students: 35,
      semester: 'S4',
      statut: 'Planifie',
      category: 'internal',
    },
    {
      code: 'LOG-301',
      title: "Systemes d'information logistique",
      description: 'ERP, WMS, TMS et digitalisation de la supply chain.',
      duration: '70h',
      students: 40,
      semester: 'S4',
      statut: 'Planifie',
      category: 'internal',
    },
    {
      code: 'LOG-302',
      title: 'Lean Management & Qualite',
      description: 'Methodes Lean, amelioration continue et pilotage de la performance.',
      duration: '75h',
      students: 31,
      semester: 'S5',
      statut: 'En cours',
      category: 'internal',
    },
    {
      code: 'LNG-101',
      title: 'Anglais professionnel logistique',
      description: 'Communication professionnelle en anglais pour la logistique et le transport.',
      duration: '45h',
      students: 52,
      semester: 'S2',
      statut: 'En cours',
      category: 'internal',
    },
    {
      code: 'PFE-401',
      title: 'Projet de fin d etudes',
      description: 'Projet applique en entreprise avec encadrement academique et industriel.',
      duration: '140h',
      students: 26,
      semester: 'S6',
      statut: 'Planifie',
      category: 'internal',
    },
    {
      code: 'QSE-220',
      title: 'Qualite, securite et environnement en transport',
      description: 'Cadres QHSE, prevention des risques et controle de conformite dans les operations logistiques.',
      duration: '60h',
      students: 24,
      semester: 'S5',
      statut: 'Planifie',
      category: 'internal',
    },
    {
      code: 'SAP-EXT',
      title: 'Certification SAP S/4HANA Supply Chain',
      description: 'Certification externe axee sur les processus achats, stocks et planification integree sur SAP.',
      duration: '48h',
      students: 18,
      semester: 'Certif',
      statut: 'Planifie',
      category: 'external',
    },
    {
      code: 'APICS-CPIM',
      title: 'APICS CPIM preparation',
      description: 'Preparation specialisee a la certification CPIM pour la planification et la maitrise des ressources.',
      duration: '56h',
      students: 14,
      semester: 'Certif',
      statut: 'En cours',
      category: 'external',
    },
    {
      code: 'IATA-001',
      title: 'IATA Cargo Introductif',
      description: 'Bases du fret aerien, documentation cargo et normes operationnelles IATA.',
      duration: '36h',
      students: 16,
      semester: 'Certif',
      statut: 'En cours',
      category: 'external',
    },
    {
      code: 'FIATA-101',
      title: 'FIATA Freight Forwarding',
      description: 'Programme specialise pour le transit international et la coordination multimodale.',
      duration: '50h',
      students: 11,
      semester: 'Certif',
      statut: 'Planifie',
      category: 'external',
    },
    {
      code: 'ISO-28000',
      title: 'Auditeur interne ISO 28000',
      description: 'Formation externe sur la securisation de la chaine logistique et l audit des systemes associes.',
      duration: '32h',
      students: 13,
      semester: 'Certif',
      statut: 'Planifie',
      category: 'external',
    },
    {
      code: 'TMS-PRO',
      title: 'TMS Avance pour exploitants',
      description: 'Perfectionnement sur les outils TMS et le pilotage des tournees en temps reel.',
      duration: '40h',
      students: 20,
      semester: 'Certif',
      statut: 'En cours',
      category: 'external',
    },
    {
      code: 'EXCEL-SC',
      title: 'Excel & Power BI pour Supply Chain',
      description: 'Analyse de donnees, tableaux de bord et indicateurs pour la performance logistique.',
      duration: '45h',
      students: 27,
      semester: 'Certif',
      statut: 'En cours',
      category: 'external',
    },
    {
      code: 'INC-2026',
      title: 'Incoterms 2020 expertise appliquee',
      description: 'Application pratique des Incoterms dans les contrats, achats et expeditions internationales.',
      duration: '24h',
      students: 22,
      semester: 'Certif',
      statut: 'Planifie',
      category: 'external',
    },
    {
      code: 'WMS-LAB',
      title: 'Pilotage WMS & entrepot connecte',
      description: 'Formation specialisee sur la digitalisation de l entrepot et le suivi des flux temps reel.',
      duration: '38h',
      students: 19,
      semester: 'Certif',
      statut: 'En cours',
      category: 'external',
    },
    {
      code: 'GREEN-LOG',
      title: 'Logistique durable & bilan carbone',
      description: 'Approche externe specialisee sur la performance environnementale et les indicateurs carbone.',
      duration: '28h',
      students: 17,
      semester: 'Certif',
      statut: 'Planifie',
      category: 'external',
    },
  ];

  constructor(private router: Router) {}

  private emptyFormation(): Formation {
    return {
      code: '',
      title: '',
      description: '',
      duration: '',
      students: 0,
      semester: 'S1',
      statut: 'En cours',
      category: 'internal',
    };
  }

  get internalFormations(): Formation[] {
    return this.formations.filter((formation) => formation.category === 'internal');
  }

  get externalFormations(): Formation[] {
    return this.formations.filter((formation) => formation.category === 'external');
  }

  get visibleInternalFormations(): Formation[] {
    return this.showAllInternal
      ? this.internalFormations
      : this.internalFormations.slice(0, this.previewLimit);
  }

  get visibleExternalFormations(): Formation[] {
    return this.showAllExternal
      ? this.externalFormations
      : this.externalFormations.slice(0, this.previewLimit);
  }

  canShowMore(category: FormationCategory): boolean {
    const list = category === 'internal' ? this.internalFormations : this.externalFormations;
    return list.length > this.previewLimit;
  }

  toggleShowAll(category: FormationCategory): void {
    if (category === 'internal') {
      this.showAllInternal = !this.showAllInternal;
      return;
    }

    this.showAllExternal = !this.showAllExternal;
  }

  openAddForm(): void {
    this.showAddForm = true;
    this.formError = '';
    this.newFormation = this.emptyFormation();
  }

  cancelAdd(): void {
    this.showAddForm = false;
    this.formError = '';
  }

  addFormation(): void {
    const f = this.newFormation;
    if (!f.code.trim() || !f.title.trim() || !f.description.trim() || !f.duration.trim() || !f.semester.trim()) {
      this.formError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }
    if (f.students < 0) {
      this.formError = 'Le nombre d etudiants doit etre positif.';
      return;
    }

    this.formations = [
      {
        code: f.code.trim().toUpperCase(),
        title: f.title.trim(),
        description: f.description.trim(),
        duration: f.duration.trim(),
        students: Number(f.students),
        semester: f.semester.trim().toUpperCase(),
        statut: f.statut,
        category: 'internal',
      },
      ...this.formations,
    ];

    this.showAllInternal = false;

    this.cancelAdd();
  }

  logout(): void {
    this.router.navigate(['/']);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
