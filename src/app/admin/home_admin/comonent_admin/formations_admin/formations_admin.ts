import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
export class FormationsAdmin {
  searchTerm: string = '';
  sortColumn: keyof Competence = 'code';
  sortDirection: 'asc' | 'desc' = 'asc';

  competences: Competence[] = [
    { code: 'TL-TECH-001', name: 'Incoterms 2020', category: 'Techniques', domain: 'Supply Chain' },
    { code: 'TL-TECH-002', name: 'Gestion douanière', category: 'Techniques', domain: 'Transit' },
    { code: 'TL-TECH-003', name: 'Transit international', category: 'Techniques', domain: 'Transit' },
    { code: 'TL-TECH-004', name: 'Transport multimodal', category: 'Techniques', domain: 'Transport Maritime' },
    { code: 'TL-ORG-001', name: 'Gestion des flux', category: 'Organisationnelle', domain: 'Logistique' },
    { code: 'TL-ORG-002', name: 'Planification S&OP', category: 'Organisationnelle', domain: 'Supply Chain' },
    { code: 'TL-PHY-001', name: 'Manutention sécurisée', category: 'Physique', domain: 'Entrepôt' },
    { code: 'TL-PHY-002', name: 'Conduite de chariots', category: 'Physique', domain: 'Entrepôt' },
    { code: 'TL-COMP-001', name: 'Esprit d\'équipe', category: 'Comportementale', domain: 'Général' },
    { code: 'TL-COMP-002', name: 'Réactivité & Urgence', category: 'Comportementale', domain: 'Opérations' },
    { code: 'TL-TECH-005', name: "Gestion d'entrepôt (WMS)", category: 'Techniques', domain: 'Logistique' },
    { code: 'TL-TECH-006', name: 'Supply Chain Management', category: 'Techniques', domain: 'Supply Chain' },
    { code: 'TL-ORG-003', name: 'Optimisation de tournées', category: 'Organisationnelle', domain: 'Transport' },
  ];

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
    return this.competences.filter(c => c.category === cat).length;
  }

  get filteredCompetences(): Competence[] {
    let filtered = this.competences;
    
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.code.toLowerCase().includes(term) ||
        c.domain.toLowerCase().includes(term)
      );
    }

    return filtered.sort((a, b) => {
      const valA = a[this.sortColumn];
      const valB = b[this.sortColumn];
      
      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
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

  trackByCode(index: number, item: any): string {
    return item.code;
  }
}
