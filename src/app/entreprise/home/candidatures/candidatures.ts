import { Component, OnDestroy, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CandidaturesService, CompanyCandidature } from './candidatures.service';

interface CandidatureItem {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  ville: string;
  timeAgo: string;
  score: number;
  scoreATS: number | null;
  poste: string;
  competences: string[];
}

@Component({
  selector: 'app-candidatures',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './candidatures.html',
  styleUrls: ['./candidatures.css']
})
export class Candidatures implements OnInit, OnDestroy {
  private readonly candidaturesService = inject(CandidaturesService);
  private readonly destroy$ = new Subject<void>();
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private loadWatchdog: number | null = null;

  searchQuery = '';
  selectedPoste = 'Tous';
  isLoading = false;
  errorMessage = '';

  candidatures: CandidatureItem[] = [];

  ngOnInit(): void {
    this.loadCandidatures();
  }

  ngOnDestroy(): void {
    this.clearLoadWatchdog();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCandidatures(): void {
    this.ngZone.run(() => {
      this.isLoading = true;
      this.errorMessage = '';
    });

    this.clearLoadWatchdog();
    this.loadWatchdog = window.setTimeout(() => {
      this.ngZone.run(() => {
        this.isLoading = false;
        if (!this.errorMessage) {
          this.errorMessage = 'Le chargement des candidatures prend trop de temps. Veuillez reessayer.';
        }
        this.cdr.detectChanges();
      });
    }, 12000);

    this.candidaturesService
      .fetchCompanyCandidatures()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (rows) => {
          this.clearLoadWatchdog();
          this.ngZone.run(() => {
            this.candidatures = (rows || []).map((row) => this.toCandidatureItem(row));
            this.selectedPoste = 'Tous';
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
        error: (error) => {
          this.clearLoadWatchdog();
          this.ngZone.run(() => {
            this.candidatures = [];
            this.errorMessage = error?.message || 'Impossible de charger les candidatures.';
            this.isLoading = false;
            this.cdr.detectChanges();
          });
        },
      });
  }

  private clearLoadWatchdog(): void {
    if (this.loadWatchdog !== null) {
      window.clearTimeout(this.loadWatchdog);
      this.loadWatchdog = null;
    }
  }

  private toCandidatureItem(row: CompanyCandidature): CandidatureItem {
    const score = Number(row.score_employabilite);

    return {
      id: String(row.id),
      prenom: String(row.prenom || '').trim() || 'Etudiant',
      nom: String(row.nom || '').trim() || '',
      email: String(row.email || '').trim(),
      ville: String(row.ville || '').trim() || 'N/A',
      timeAgo: this.getTimeAgo(row.date_creation),
      score: Number.isFinite(score) ? Math.round(score) : 0,
      scoreATS: null,
      poste: String(row.poste || '').trim() || 'Poste',
      competences: Array.isArray(row.competences) ? row.competences : [],
    };
  }

  get postes(): string[] {
    const postes = Array.from(new Set(this.candidatures.map((c) => c.poste).filter(Boolean))).sort();
    return ['Tous', ...postes];
  }

  setPoste(p: string): void {
    this.selectedPoste = p;
  }

  get filteredCandidatures(): CandidatureItem[] {
    const q = this.searchQuery.toLowerCase();
    return this.candidatures
      .filter(c =>
        (this.selectedPoste === 'Tous' || c.poste === this.selectedPoste) &&
        (!q ||
          c.prenom.toLowerCase().includes(q) ||
          c.nom.toLowerCase().includes(q) ||
          c.competences.some(s => s.toLowerCase().includes(q))
        )
      )
      .sort((a, b) => b.score - a.score);
  }

  get groupedCandidatures(): { poste: string; candidats: CandidatureItem[] }[] {
    const q = this.searchQuery.toLowerCase();
    const allSorted = this.candidatures
      .filter(c =>
        !q ||
        c.prenom.toLowerCase().includes(q) ||
        c.nom.toLowerCase().includes(q) ||
        c.competences.some(s => s.toLowerCase().includes(q))
      )
      .sort((a, b) => b.score - a.score);

    const groups: Record<string, CandidatureItem[]> = {};
    for (const c of allSorted) {
      if (!groups[c.poste]) groups[c.poste] = [];
      groups[c.poste].push(c);
    }

    return Object.keys(groups).map(poste => ({
      poste,
      candidats: groups[poste]
    }));
  }

  get totalCandidats(): number {
    return this.filteredCandidatures.length;
  }

  get avgScore(): number {
    if (!this.filteredCandidatures.length) return 0;
    return Math.round(
      this.filteredCandidatures.reduce((s, c) => s + c.score, 0) /
      this.filteredCandidatures.length
    );
  }

  // ✅ top = score >= 90
  get topCandidats(): number {
    return this.filteredCandidatures.filter(c => c.score >= 90).length;
  }

  get percentTop(): number {
    if (!this.totalCandidats) return 0;
    return Math.round((this.topCandidats / this.totalCandidats) * 100);
  }

  getInitials(p: string, n: string): string {
    const first = (p || '').trim().charAt(0) || 'E';
    const last = (n || '').trim().charAt(0) || 'T';
    return (first + last).toUpperCase();
  }

  getScoreClass(score: number): string {
    if (score >= 89) return 'excellent';
    if (score >= 70) return 'bon';
    if (score >= 60) return 'moyen';
    return 'faible';
  }

  getScoreLabel(score: number): string {
    if (score >= 89) return 'Excellent';
    if (score >= 70) return 'Bien';
    return 'Faible';
  }

  private getTimeAgo(date: string | undefined): string {
    if (!date) {
      return 'N/A';
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }
    const diffDays = Math.floor((Date.now() - parsed.getTime()) / 86400000);
    if (diffDays <= 0) {
      return 'Aujourd\'hui';
    }
    return `${diffDays}j`;
  }
}