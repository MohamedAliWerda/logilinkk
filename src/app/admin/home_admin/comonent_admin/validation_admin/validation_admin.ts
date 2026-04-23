import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Recommendation,
  RecommendationJob,
  ValidationAdminService,
} from './validation-admin.service';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'edited';

@Component({
  selector: 'app-validation-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validation_admin.html',
  styleUrl: './validation_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationAdmin implements OnInit, OnDestroy {
  recommendations: Recommendation[] = [];
  loading = false;
  generating = false;
  loadError = '';
  actionError = '';
  statusFilter: StatusFilter = 'pending';

  currentJob: RecommendationJob | null = null;
  private pollTimer: any = null;

  editingId: string | null = null;
  editDraft: Partial<Recommendation> = {};

  rejectPromptId: string | null = null;
  rejectComment = '';

  constructor(
    private readonly svc: ValidationAdminService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    try {
      const filter = this.statusFilter === 'all' ? undefined : this.statusFilter;
      this.recommendations = await this.svc.list(filter);
    } catch (err: any) {
      this.loadError = this.formatError(err, 'Impossible de charger les recommandations.');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async generate(): Promise<void> {
    this.generating = true;
    this.actionError = '';
    try {
      const res = await this.svc.trigger();
      const jobId = res?.jobId;
      if (!jobId) {
        this.actionError = 'Reponse invalide du serveur: jobId manquant.';
        this.generating = false;
        return;
      }
      this.currentJob = { id: jobId, status: 'running' };
      this.startPolling(jobId);
    } catch (err: any) {
      this.actionError = this.formatError(err, 'La generation a echoue.');
      this.generating = false;
    } finally {
      this.cdr.markForCheck();
    }
  }

  private startPolling(jobId: string): void {
    this.stopPolling();
    this.pollTimer = setInterval(async () => {
      try {
        const job = await this.svc.getJob(jobId);
        this.currentJob = job;
        if (job.status === 'succeeded' || job.status === 'failed') {
          this.stopPolling();
          this.generating = false;
          if (job.status === 'succeeded') {
            await this.refresh();
          } else if (job.error) {
            this.actionError = job.error;
          }
        }
        this.cdr.markForCheck();
      } catch (err: any) {
        this.actionError = this.formatError(err, 'Impossible de lire le statut du job.');
        this.stopPolling();
        this.generating = false;
        this.cdr.markForCheck();
      }
    }, 2500);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  setFilter(filter: StatusFilter): void {
    if (this.statusFilter === filter) return;
    this.statusFilter = filter;
    void this.refresh();
  }

  startEdit(reco: Recommendation): void {
    this.editingId = reco.id;
    this.editDraft = {
      cert_title: reco.cert_title ?? '',
      cert_provider: reco.cert_provider ?? '',
      cert_duration: reco.cert_duration ?? '',
      cert_pricing: reco.cert_pricing ?? '',
      cert_url: reco.cert_url ?? '',
      cert_description: reco.cert_description ?? '',
      llm_recommendation: reco.llm_recommendation ?? '',
      gap_label: reco.gap_label ?? '',
      gap_title: reco.gap_title ?? '',
      level: reco.level,
    };
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editDraft = {};
    this.cdr.markForCheck();
  }

  async saveEdit(id: string): Promise<void> {
    this.actionError = '';
    try {
      await this.svc.update(id, this.editDraft);
      this.editingId = null;
      this.editDraft = {};
      await this.refresh();
    } catch (err: any) {
      this.actionError = this.formatError(err, 'La sauvegarde a echoue.');
      this.cdr.markForCheck();
    }
  }

  async approve(id: string): Promise<void> {
    this.actionError = '';
    try {
      await this.svc.approve(id);
      await this.refresh();
    } catch (err: any) {
      this.actionError = this.formatError(err, "L'approbation a echoue.");
      this.cdr.markForCheck();
    }
  }

  openReject(id: string): void {
    this.rejectPromptId = id;
    this.rejectComment = '';
    this.cdr.markForCheck();
  }

  cancelReject(): void {
    this.rejectPromptId = null;
    this.rejectComment = '';
    this.cdr.markForCheck();
  }

  async confirmReject(): Promise<void> {
    if (!this.rejectPromptId) return;
    const id = this.rejectPromptId;
    this.actionError = '';
    try {
      await this.svc.reject(id, this.rejectComment);
      this.rejectPromptId = null;
      this.rejectComment = '';
      await this.refresh();
    } catch (err: any) {
      this.actionError = this.formatError(err, 'Le rejet a echoue.');
      this.cdr.markForCheck();
    }
  }

  get stats() {
    const total = this.recommendations.length;
    const byLevel = (level: string) =>
      this.recommendations.filter((r) => (r.level ?? '').toUpperCase() === level).length;
    return {
      total,
      critique: byLevel('CRITIQUE'),
      haute: byLevel('HAUTE'),
      moyenne: byLevel('MOYENNE'),
      faible: byLevel('FAIBLE'),
    };
  }

  levelClass(level: string | null | undefined): string {
    const v = (level ?? '').toUpperCase();
    if (v === 'CRITIQUE') return 'lvl-critique';
    if (v === 'HAUTE') return 'lvl-haute';
    if (v === 'MOYENNE') return 'lvl-moyenne';
    return 'lvl-faible';
  }

  statusClass(status: string | null | undefined): string {
    const v = (status ?? '').toLowerCase();
    if (v === 'approved') return 'sts-approved';
    if (v === 'rejected') return 'sts-rejected';
    if (v === 'edited') return 'sts-edited';
    return 'sts-pending';
  }

  keywordsLabel(keywords: string[] | null | undefined): string {
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) return '';
    return keywords.slice(0, 4).join(', ');
  }

  trackById(_index: number, item: Recommendation): string {
    return item.id;
  }

  private formatError(err: any, fallback: string): string {
    const detail = err?.error?.detail ?? err?.error?.message ?? err?.message;
    return typeof detail === 'string' && detail.trim().length ? detail : fallback;
  }
}
