import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReferentielApiService } from './referentiel-api.service';

type CompetenceCategory = 'Techniques' | 'Organisationnelle' | 'Physique' | 'Comportementale';

interface Competence {
  code: string;
  name: string;
  category: CompetenceCategory;
  domain: string;
}

interface PartnerSkill {
  code: string;
  name: string;
  description: string;
  category: string;
  domain: string;
  startDate: string;
  partner: string;
}

@Component({
  selector: 'app-formations-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formations_admin.html',
  styleUrl: './formations_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormationsAdmin implements OnInit {
  searchTerm: string = '';
  selectedDomain: string = '';
  sortColumn: keyof Competence = 'code';
  sortDirection: 'asc' | 'desc' = 'asc';
  loadingCompetences = false;
  competencesError = '';

  competences: Competence[] = [];

  constructor(
    private readonly referentielApiService: ReferentielApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadCompetences();
  }

  partnerSkills: PartnerSkill[] = [
    {
      code: 'PART-SAP-01',
      name: 'Expertise SAP S/4HANA',
      description: 'Maitrise avancée des modules logistiques et intégration des processus supply chain.',
      category: 'Technique',
      domain: 'Digitalization',
      startDate: '2026-03-20',
      partner: 'SAP Academic Alliances'
    },
    {
      code: 'PART-CMA-02',
      name: 'Opérations Portuaires',
      description: 'Formation spécialisée sur la gestion des escales et le suivi des conteneurs.',
      category: 'Technique',
      domain: 'Logistique Maritime',
      startDate: '2026-04-10',
      partner: 'CMA CGM Academy'
    },
    {
      code: 'PART-GEOD-03',
      name: 'Freight Forwarding Export',
      description: 'Optimisation des plans de transport internationaux et gestion documentaire.',
      category: 'Technique',
      domain: 'Transit',
      startDate: '2026-05-15',
      partner: 'GEODIS University'
    },
    {
      code: 'PART-DHL-04',
      name: 'E-commerce Logistics',
      description: 'Stratégies de dernier kilomètre et gestion des retours automatisée.',
      category: 'Organisationnelle',
      domain: 'Supply Chain',
      startDate: '2026-02-01',
      partner: 'DHL Supply Chain'
    }
  ];

  get stats() {
    return {
      total: this.competences.length,
      tech: this.countCategory('Techniques'),
      org: this.countCategory('Organisationnelle'),
      phys: this.countCategory('Physique'),
      comp: this.countCategory('Comportementale'),
    };
  }

  private countCategory(cat: CompetenceCategory): number {
    return this.competences.filter((c) => this.normalizeCategory(c.category) === cat)
      .length;
  }

  get filteredCompetences(): Competence[] {
    let filtered = this.competences;

    if (this.selectedDomain.trim()) {
      filtered = filtered.filter((c) => c.domain === this.selectedDomain);
    }
    
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.code.toLowerCase().includes(term) ||
        c.domain.toLowerCase().includes(term)
      );
    }

    return [...filtered].sort((a, b) => {
      const valA = String(a[this.sortColumn] ?? '');
      const valB = String(b[this.sortColumn] ?? '');

      const compare = valA.localeCompare(valB, 'fr', { sensitivity: 'base' });
      if (compare < 0) return this.sortDirection === 'asc' ? -1 : 1;
      if (compare > 0) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  get domainOptions(): string[] {
    return [...new Set(this.competences.map((c) => c.domain))].sort((a, b) =>
      a.localeCompare(b, 'fr', { sensitivity: 'base' }),
    );
  }

  async loadCompetences(): Promise<void> {
    this.loadingCompetences = true;
    this.competencesError = '';

    try {
      const rows = await this.referentielApiService.getCompetences();
      this.competences = rows.map((row) => ({
        code: row.code,
        name: row.competence,
        category: this.normalizeCategory(row.categorie),
        domain: row.domaine,
      }));
    } catch {
      this.competencesError =
        'Impossible de charger le referentiel competences depuis le backend.';
    } finally {
      this.loadingCompetences = false;
      this.cdr.markForCheck();
    }
  }

  private normalizeCategory(value: string): CompetenceCategory {
    const normalized = value.toLowerCase();

    if (normalized.includes('tech')) {
      return 'Techniques';
    }
    if (normalized.includes('org')) {
      return 'Organisationnelle';
    }
    if (normalized.includes('phys')) {
      return 'Physique';
    }
    return 'Comportementale';
  }

  setSort(column: keyof Competence) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  showPartnerForm: boolean = false;
  newPartnerSkill: PartnerSkill = this.initPartnerSkill();
  categories: string[] = ['Technique', 'Organisationnelle', 'Physique', 'Comportementale'];

  private initPartnerSkill(): PartnerSkill {
    return {
      code: '',
      name: '',
      description: '',
      category: 'Technique',
      domain: '',
      startDate: new Date().toISOString().split('T')[0],
      partner: ''
    };
  }

  openPartnerForm(): void {
    this.showPartnerForm = true;
    this.newPartnerSkill = this.initPartnerSkill();
  }

  closePartnerForm(): void {
    this.showPartnerForm = false;
  }

  addPartnerSkill(): void {
    if (this.newPartnerSkill.code && this.newPartnerSkill.name && this.newPartnerSkill.partner) {
      this.partnerSkills = [
        { ...this.newPartnerSkill },
        ...this.partnerSkills
      ];
      this.closePartnerForm();
    }
  }

  trackByCode(index: number, item: { code: string }): string {
    return item.code;
  }
}
