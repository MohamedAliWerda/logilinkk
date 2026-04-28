import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecommendationService, StudentRecommendation } from './recommendation.service';

type DisplayLevel = 'CRITIQUE' | 'MOYEN' | 'FAIBLE';

@Component({
  selector: 'app-recommendation',
  imports: [CommonModule],
  templateUrl: './recommendation.html',
  styleUrl: './recommendation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Recommendation implements OnInit {
  private readonly recommendationService = inject(RecommendationService);

  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly approvedRecommendations = signal<StudentRecommendation[]>([]);

  readonly critiqueRecommendations = computed(() => this.byLevel('CRITIQUE'));
  readonly moyenRecommendations = computed(() => this.byLevel('MOYEN'));
  readonly faibleRecommendations = computed(() => this.byLevel('FAIBLE'));

  readonly totalRecommendations = computed(
    () =>
      this.critiqueRecommendations().length
      + this.moyenRecommendations().length
      + this.faibleRecommendations().length,
  );

  ngOnInit(): void {
    void this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');

    try {
      const rows = await this.recommendationService.listApprovedForStudent();
      const prioritizedRows = rows.filter((row) => this.levelForItem(row) !== null);

      prioritizedRows.sort((a, b) => {
        const similarityA = this.studentSimilarity(a);
        const similarityB = this.studentSimilarity(b);

        if (similarityA !== null && similarityB !== null && similarityA !== similarityB) {
          return similarityA - similarityB;
        }

        if (similarityA !== null && similarityB === null) {
          return -1;
        }

        if (similarityA === null && similarityB !== null) {
          return 1;
        }

        const rateA = Number.isFinite(Number(a.concern_rate)) ? Number(a.concern_rate) : 0;
        const rateB = Number.isFinite(Number(b.concern_rate)) ? Number(b.concern_rate) : 0;
        return rateB - rateA;
      });

      this.approvedRecommendations.set(prioritizedRows);
    } catch (error: unknown) {
      const detail = (error as { error?: { detail?: string; message?: string }; message?: string })?.error?.detail
        ?? (error as { error?: { detail?: string; message?: string }; message?: string })?.error?.message
        ?? (error as { message?: string })?.message
        ?? '';
      this.loadError.set(typeof detail === 'string' && detail.trim().length
        ? detail
        : 'Impossible de charger vos recommandations validees.');
      this.approvedRecommendations.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  recommendationTitle(item: StudentRecommendation): string {
    return item.cert_title?.trim()
      || item.gap_title?.trim()
      || item.competence_name?.trim()
      || 'Recommandation validee';
  }

  levelLabel(level: DisplayLevel): string {
    if (level === 'CRITIQUE') return 'Critique';
    if (level === 'MOYEN') return 'Moyen';
    return 'Faible';
  }

  recommendationContext(item: StudentRecommendation): string {
    const metier = item.metier?.trim() ?? '';
    const domaine = item.domaine?.trim() ?? '';
    if (metier && domaine) return `${metier} - ${domaine}`;
    return metier || domaine || 'Parcours etudiant';
  }

  keywordsText(item: StudentRecommendation): string {
    const keywords = Array.isArray(item.keywords)
      ? item.keywords.map((keyword) => String(keyword).trim()).filter(Boolean)
      : [];
    return keywords.slice(0, 4).join(', ');
  }

  concernRate(item: StudentRecommendation): number {
    const similarity = this.studentSimilarity(item);
    if (similarity !== null) {
      return Math.round(similarity * 100);
    }

    const value = Number(item.concern_rate);
    return Number.isFinite(value) ? value : 0;
  }

  private studentSimilarity(item: StudentRecommendation): number | null {
    const value = Number(item.student_similarity_score);
    if (!Number.isFinite(value)) {
      return null;
    }

    return Math.max(0, Math.min(1, value));
  }

  private byLevel(level: DisplayLevel): StudentRecommendation[] {
    return this.approvedRecommendations().filter((item) => this.levelForItem(item) === level);
  }

  private levelForItem(item: StudentRecommendation): DisplayLevel | null {
    const similarity = this.studentSimilarity(item);
    if (similarity !== null) {
      return this.levelFromSimilarity(similarity);
    }

    return this.normalizeLevel(item.level);
  }

  private levelFromSimilarity(similarity: number): DisplayLevel {
    if (similarity < 0.30) return 'CRITIQUE';
    if (similarity < 0.50) return 'MOYEN';
    return 'FAIBLE';
  }

  private normalizeLevel(level: string | null | undefined): DisplayLevel | null {
    const normalized = String(level ?? '').trim().toUpperCase();
    if (normalized === 'CRITIQUE') return 'CRITIQUE';
    if (normalized === 'FAIBLE') return 'FAIBLE';
    if (normalized === 'HAUTE' || normalized === 'MOYENNE' || normalized === 'MOYEN') return 'MOYEN';
    return null;
  }
}

