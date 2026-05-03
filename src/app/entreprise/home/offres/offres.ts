import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';

export interface Offre {
  id: string;
  titre: string;
  entreprise?: string;
  lieu?: string;
  typeContrat?: string;
  source?: string;
  description: string;
  competences: string[];
  candidaturesCount?: number;
  salaireMin?: number;
  salaireMax?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-offres',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './offres.html',
  styleUrls: ['./offres.css']
})
export class Offres implements OnInit {
  offres: Offre[] = [];
  filteredOffres: Offre[] = [];
  searchQuery = '';
  isLoading = false;

  showCreateModal = false;
  showEditModal = false;
  editingOffre: Offre | null = null;

  offreForm: FormGroup;
  isSaving = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
  ) {
    this.offreForm = this.fb.group({
      titre: ['', Validators.required],
      entreprise: ['', Validators.required],
      description: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadOffres();
  }

  get totalCandidatures(): number {
    return this.offres.reduce((sum, offre) => sum + (offre.candidaturesCount || 0), 0);
  }

  get totalCompetences(): number {
    const allCompetences = new Set<string>();
    this.offres.forEach(offre =>
      offre.competences?.forEach((comp: string) => allCompetences.add(comp))
    );
    return allCompetences.size;
  }

  loadOffres(): void {
    this.isLoading = true;
    this.offres = this.getExempleOffres();
    this.filteredOffres = [...this.offres];
    this.isLoading = false;
  }

  filterOffres(): void {
    if (!this.searchQuery.trim()) {
      this.filteredOffres = [...this.offres];
    } else {
      const query = this.searchQuery.toLowerCase();
      this.filteredOffres = this.offres.filter(offre =>
        offre.titre.toLowerCase().includes(query) ||
        offre.entreprise?.toLowerCase().includes(query) ||
        offre.description.toLowerCase().includes(query)
      );
    }
  }

  openCreateModal(): void {
    this.showCreateModal = true;
    this.offreForm.reset();
  }

  openEditModal(offre: Offre): void {
    this.showEditModal = true;
    this.editingOffre = offre;
    this.offreForm.patchValue({
      titre: offre.titre,
      entreprise: offre.entreprise,
      description: offre.description
    });
  }

  closeModals(): void {
    this.showCreateModal = false;
    this.showEditModal = false;
    this.editingOffre = null;
    this.offreForm.reset();
  }

  submitOffre(): void {
    if (this.offreForm.valid) {
      this.isSaving = true;
      const newOffre: Offre = {
        id: 'offre-' + Date.now(),
        titre: this.offreForm.value.titre,
        entreprise: this.offreForm.value.entreprise,
        description: this.offreForm.value.description,
        competences: [],
        candidaturesCount: 0,
        createdAt: new Date().toISOString()
      };
      this.offres.unshift(newOffre);
      this.filterOffres();
      this.closeModals();
      this.isSaving = false;
    }
  }

  submitEditOffre(): void {
    if (this.offreForm.valid && this.editingOffre) {
      this.isSaving = true;
      const index = this.offres.findIndex(o => o.id === this.editingOffre!.id);
      if (index !== -1) {
        this.offres[index] = {
          ...this.editingOffre,
          titre: this.offreForm.value.titre,
          entreprise: this.offreForm.value.entreprise,
          description: this.offreForm.value.description
        };
      }
      this.filterOffres();
      this.closeModals();
      this.isSaving = false;
    }
  }

  deleteOffre(offre: Offre): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette offre ?')) {
      this.offres = this.offres.filter(o => o.id !== offre.id);
      this.filterOffres();
    }
  }

  viewCandidatures(offre: Offre): void {
    this.router.navigate(['/entreprise/candidatures', offre.id]);
  }

  getTimeAgo(date: string | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return 'Il y a 1 jour';
    if (diff < 7) return `Il y a ${diff} jours`;
    if (diff < 14) return 'Il y a 1 semaine';
    return `Il y a ${Math.floor(diff / 7)} semaines`;
  }

  private getExempleOffres(): Offre[] {
    return [
      {
        id: 'exemple-1',
        titre: 'Développeur Full-Stack Senior',
        entreprise: 'TechCorp',
        lieu: 'Casablanca · Hybride',
        typeContrat: 'CDI',
        source: 'partenaire',
        description: 'Rejoignez notre équipe pour bâtir la prochaine génération de notre plateforme logistique.',
        competences: ['React', 'Node.js', 'PostgreSQL', 'AWS', 'TypeScript'],
        candidaturesCount: 24,
        salaireMin: 1800,
        salaireMax: 2800,
        createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
      },
      {
        id: 'exemple-2',
        titre: 'Data Scientist — IA Matching',
        entreprise: 'DataVision',
        lieu: 'Rabat · Remote',
        typeContrat: 'CDI',
        source: 'partenaire',
        description: "Améliorez nos modèles de scoring ATS et d'employabilité grâce au machine learning.",
        competences: ['Python', 'PyTorch', 'NLP', 'MLOps'],
        candidaturesCount: 17,
        salaireMin: 2000,
        salaireMax: 3200,
        createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
      },
      {
        id: 'exemple-3',
        titre: 'Designer UX/UI',
        entreprise: 'CreativeStudio',
        lieu: 'Sfax · Présentiel',
        typeContrat: 'CDD',
        source: 'linkedin',
        description: 'Concevez des interfaces intuitives et modernes pour nos applications web et mobile.',
        competences: ['Figma', 'Adobe XD', 'Prototypage', 'Design System'],
        candidaturesCount: 31,
        salaireMin: 1200,
        salaireMax: 1800,
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
      }
    ];
  }
}