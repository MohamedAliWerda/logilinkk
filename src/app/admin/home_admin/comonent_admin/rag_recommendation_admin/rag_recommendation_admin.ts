import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CertificationPayload,
  RagRecommendationApiService,
  RecommendationItem,
  RecommendationLevel,
  RecommendationStatus,
} from './rag-recommendation-api.service';

type RecommendationWithDraft = RecommendationItem;

@Component({
  selector: 'app-rag-recommendation-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rag_recommendation_admin.html',
  styleUrl: './rag_recommendation_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagRecommendationAdmin implements OnInit {
  recommendations: RecommendationWithDraft[] = [];
  selectedLevel: 'ALL' | RecommendationLevel = 'ALL';
  showEditModal = false;
  editingItem: RecommendationWithDraft | null = null;
  editCertification: CertificationPayload = this.createEmptyCertification();
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private readonly api: RagRecommendationApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.fetchRecommendations();
  }

  get filteredRecommendations(): RecommendationWithDraft[] {
    const visible = this.recommendations.filter((item) => item.status !== 'DELETED');
    if (this.selectedLevel === 'ALL') {
      return visible;
    }

    return visible.filter((item) => item.level === this.selectedLevel);
  }

  get totalStudents(): number {
    return this.recommendations.reduce((sum, item) => sum + item.totalStudents, 0);
  }

  get criticalCount(): number {
    return this.recommendations.filter((item) => item.level === 'CRITIQUE' && item.status !== 'DELETED').length;
  }

  get highCount(): number {
    return this.recommendations.filter((item) => item.level === 'HAUTE' && item.status !== 'DELETED').length;
  }

  get validatedCount(): number {
    return this.recommendations.filter((item) => item.status === 'CONFIRMED').length;
  }

  levelClass(level: RecommendationLevel): string {
    if (level === 'CRITIQUE') return 'chip chip-critical';
    if (level === 'HAUTE') return 'chip chip-high';
    return 'chip chip-medium';
  }

  statusClass(status: RecommendationStatus): string {
    if (status === 'CONFIRMED') return 'status status-confirmed';
    if (status === 'DELETED') return 'status status-deleted';
    return 'status status-pending';
  }

  statusLabel(status: RecommendationStatus): string {
    if (status === 'CONFIRMED') return 'Confirmee';
    if (status === 'DELETED') return 'Supprimee';
    return 'En attente';
  }

  setLevel(level: 'ALL' | RecommendationLevel): void {
    this.selectedLevel = level;
    this.successMessage = '';
  }

  startEdit(item: RecommendationWithDraft): void {
    this.editingItem = item;
    this.editCertification = { ...item.certification };
    this.showEditModal = true;
    this.successMessage = '';
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingItem = null;
    this.editCertification = this.createEmptyCertification();
  }

  saveEdit(): void {
    if (!this.editingItem) {
      return;
    }

    const itemId = this.editingItem.id;
    this.api.updateCertification(itemId, this.editCertification).subscribe((ok) => {
      if (!ok) {
        this.errorMessage = 'La mise a jour backend a echoue. Les changements restent locaux.';
      }

      const target = this.recommendations.find((item) => item.id === itemId);
      if (target) {
        target.certification = { ...this.editCertification };
        target.status = 'PENDING';
      }

      this.closeEditModal();
      this.successMessage = 'Certification mise a jour.';
      this.cdr.markForCheck();
    });
  }

  confirm(item: RecommendationWithDraft): void {
    this.api.confirmRecommendation(item.id).subscribe((ok) => {
      if (!ok) {
        this.errorMessage = 'Validation backend indisponible. Validation appliquee localement.';
      }

      item.status = 'CONFIRMED';
      this.successMessage = 'Certification confirmee.';
      this.cdr.markForCheck();
    });
  }

  delete(item: RecommendationWithDraft): void {
    this.api.deleteRecommendation(item.id).subscribe((ok) => {
      if (!ok) {
        this.errorMessage = 'Suppression backend indisponible. Suppression appliquee localement.';
      }

      item.status = 'DELETED';
      this.successMessage = 'Recommendation supprimee.';
      this.cdr.markForCheck();
    });
  }

  trackByRecommendation(_: number, item: RecommendationWithDraft): string {
    return item.id;
  }

  private createEmptyCertification(): CertificationPayload {
    return {
      title: '',
      description: '',
      provider: '',
      duration: '',
      pricing: '',
      url: '',
    };
  }

  private fetchRecommendations(): void {
    this.loading = true;
    this.errorMessage = '';

    this.api.getRecommendations().subscribe({
      next: (items) => {
        this.recommendations = items.map((item) => ({ ...item }));
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les recommandations IA.';
        this.cdr.markForCheck();
      },
    });
  }
}
