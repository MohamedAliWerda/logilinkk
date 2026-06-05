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
}
