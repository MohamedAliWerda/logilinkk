import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RecommendationAiAdminApiService,
  RecommendationRow,
  RecommendationStatus,
} from './recommendation-ai-admin.api.service';

@Component({
  selector: 'app-recommendation-ai-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './recommendation_ai_admin.html',
  styleUrl: './recommendation_ai_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecommendationAiAdmin implements OnInit {
  recommendations: RecommendationRow[] = [];
  loading = false;
  generating = false;
  errorMessage = '';
  infoMessage = '';

  readonly priorityTabs: Array<'all' | 'critique' | 'haute' | 'moyenne'> = [
    'all',
    'critique',
    'haute',
    'moyenne',
  ];
  activePriorityTab: 'all' | 'critique' | 'haute' | 'moyenne' = 'all';
  searchTerm = '';
  sortMode: 'high_to_low' | 'low_to_high' = 'high_to_low';

  private readonly editingIds = new Set<string>();

  // kept for API generation payload
  gapMinPct = 10;
  topK = 5;
  maxItems = 50;
  ragCollection = '';
  useLlm = false;

  constructor(
    private readonly api: RecommendationAiAdminApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.loadRecommendations();
  }

  async loadRecommendations(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      this.recommendations = await this.api.list(undefined);
    } catch (err: any) {
      this.errorMessage = String(err?.message ?? 'Unable to load recommendations');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async generateRecommendations(): Promise<void> {
    this.generating = true;
    this.errorMessage = '';
    this.infoMessage = '';

    try {
      const result = await this.api.generate({
        gapMinPct: this.gapMinPct,
        topK: this.topK,
        maxItems: this.maxItems,
        ragCollection: this.ragCollection.trim() || undefined,
        useLlm: this.useLlm,
      });

      this.infoMessage =
        `Generated ${result.generated} recommendations from ${result.significantGaps} significant gaps `
        + `(students: ${result.totalStudents}, collection: ${result.collection}).`;

      await this.loadRecommendations();
    } catch (err: any) {
      this.errorMessage = String(err?.message ?? 'Generation failed');
    } finally {
      this.generating = false;
      this.cdr.markForCheck();
    }
  }

  async saveRecommendation(row: RecommendationRow): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    try {
      const updated = await this.api.update(row.id, {
        recommendedCertification: row.recommended_certification,
        recommendationText: row.recommendation_text,
        adminNote: row.admin_note ?? '',
      });

      this.replaceRow(updated);
      this.editingIds.delete(row.id);
      this.infoMessage = 'Recommendation updated.';
    } catch (err: any) {
      this.errorMessage = String(err?.message ?? 'Update failed');
    } finally {
      this.cdr.markForCheck();
    }
  }

  async setStatus(row: RecommendationRow, status: RecommendationStatus): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    try {
      const updated = await this.api.update(row.id, { status });
      this.replaceRow(updated);
      this.infoMessage = `Recommendation marked as ${status}.`;
    } catch (err: any) {
      this.errorMessage = String(err?.message ?? 'Status update failed');
    } finally {
      this.cdr.markForCheck();
    }
  }

  async deleteRecommendation(row: RecommendationRow): Promise<void> {
    this.errorMessage = '';
    this.infoMessage = '';

    try {
      await this.api.remove(row.id, false);
      this.recommendations = this.recommendations.filter((entry) => entry.id !== row.id);
      this.infoMessage = 'Recommendation deleted.';
    } catch (err: any) {
      this.errorMessage = String(err?.message ?? 'Delete failed');
    } finally {
      this.cdr.markForCheck();
    }
  }

  trackById(_: number, item: RecommendationRow): string {
    return item.id;
  }

  get studentsCount(): number {
    const totals = this.recommendations
      .map((row) => this.extractTotalStudents(row))
      .filter((value): value is number => value !== null);

    if (totals.length > 0) {
      return Math.max(...totals);
    }

    const impacted = this.recommendations.map((row) => Math.max(0, Number(row.n_gap || 0)));
    return impacted.length > 0 ? Math.max(...impacted) : 0;
  }

  get criticalCount(): number {
    return this.recommendations.filter((row) => this.normalizePriority(row.priority) === 'critique').length;
  }

  get highCount(): number {
    return this.recommendations.filter((row) => this.normalizePriority(row.priority) === 'haute').length;
  }

  get mediumCount(): number {
    return this.recommendations.filter((row) => this.normalizePriority(row.priority) === 'moyenne').length;
  }

  get validatedCount(): number {
    return this.recommendations.filter((row) => row.status === 'accepted').length;
  }

  get filteredRecommendations(): RecommendationRow[] {
    const term = this.searchTerm.trim().toLowerCase();

    const rows = this.recommendations
      .filter((row) => row.status !== 'deleted')
      .filter((row) => {
        if (this.activePriorityTab === 'all') return true;
        return this.normalizePriority(row.priority) === this.activePriorityTab;
      })
      .filter((row) => {
        if (!term) return true;
        const searchable = [
          row.competence_name,
          row.metier_name,
          row.recommended_certification,
          row.keywords,
        ]
          .join(' ')
          .toLowerCase();
        return searchable.includes(term);
      })
      .slice();

    rows.sort((a, b) => {
      const left = Number(a.pct_gap || 0);
      const right = Number(b.pct_gap || 0);
      if (this.sortMode === 'low_to_high') {
        return left - right;
      }
      return right - left;
    });

    return rows;
  }

  setPriorityTab(tab: 'all' | 'critique' | 'haute' | 'moyenne'): void {
    this.activePriorityTab = tab;
  }

  tabLabel(tab: 'all' | 'critique' | 'haute' | 'moyenne'): string {
    if (tab === 'all') return 'Tous les gaps';
    return tab.toUpperCase();
  }

  getStatusLabel(status: RecommendationStatus): string {
    if (status === 'accepted') return 'Validee';
    if (status === 'rejected') return 'Rejetee';
    if (status === 'deleted') return 'Supprimee';
    return 'En attente';
  }

  keywordList(row: RecommendationRow): string[] {
    return String(row.keywords ?? '')
      .split(/[;,|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 6);
  }

  isEditing(rowId: string): boolean {
    return this.editingIds.has(rowId);
  }

  toggleEdit(rowId: string): void {
    if (this.editingIds.has(rowId)) {
      this.editingIds.delete(rowId);
    } else {
      this.editingIds.add(rowId);
    }
  }

  recommendationSummary(row: RecommendationRow): string {
    const text = String(row.recommendation_text ?? '').trim();
    if (text.length <= 210) return text;
    return `${text.slice(0, 210).trim()}...`;
  }

  cardTotalStudents(row: RecommendationRow): number {
    return this.extractTotalStudents(row) ?? this.studentsCount;
  }

  private extractTotalStudents(row: RecommendationRow): number | null {
    const text = String(row.recommendation_text ?? '');
    const countsMatch = text.match(/\((\d+)\s*\/\s*(\d+)\)/);
    if (!countsMatch) return null;
    const parsed = Number(countsMatch[2]);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.trunc(parsed));
  }

  private normalizePriority(value: string): 'critique' | 'haute' | 'moyenne' | 'faible' {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'critique') return 'critique';
    if (normalized === 'haute') return 'haute';
    if (normalized === 'moyenne') return 'moyenne';
    return 'faible';
  }

  private replaceRow(updated: RecommendationRow): void {
    this.recommendations = this.recommendations.map((item) =>
      item.id === updated.id ? updated : item,
    );
  }
}
