import { Component, ChangeDetectionStrategy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CvSubmissionService,
  MatchingAnalysisResponse,
  MatchingAnalysisTraceResponse,
  MatchingGapEntry,
  MatchingMetierRankingEntry,
} from '../cv-ats/cv-submission.service';

type DisplayMetierCard = {
  metier: string;
  domaine: string;
  coveragePct: number;
  matched: number;
  nCompetences: number;
  avgScore: number;
  topSkills: Array<{ skill: string; score: number }>;
};

type DisplayGapRow = {
  refCompetence: string;
  refMetier: string;
  refDomaine: string;
  similarityScore: number;
};

@Component({
  selector: 'app-matching',
  imports: [CommonModule],
  templateUrl: './matching.html',
  styleUrl: './matching.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Matching implements OnInit {
  loading = true;
  refreshing = false;
  errorMessage = '';
  analysis: MatchingAnalysisResponse | null = null;
  trace: MatchingAnalysisTraceResponse | null = null;
  targetMetierLabel = '';
  private metierLookupLoaded = false;
  private readonly metierLabelById = new Map<string, string>();

  constructor(
    private readonly cvSubmissionService: CvSubmissionService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    const cachedTrace = this.cvSubmissionService.getCachedMatchingAnalysisTrace();
    if (cachedTrace) {
      this.trace = cachedTrace;
      this.analysis = cachedTrace.analysis;
      this.loading = false;
      this.cdr.markForCheck();
      void this.resolveTargetMetierLabel();
    } else {
      const cached = this.cvSubmissionService.getCachedMatchingAnalysis();
      if (cached) {
        this.analysis = cached;
        this.loading = false;
        this.cdr.markForCheck();
        void this.resolveTargetMetierLabel();
      }
    }

    try {
      const freshTrace = await this.cvSubmissionService.fetchMatchingAnalysisTrace(false);
      if (freshTrace) {
        this.trace = freshTrace;
        this.analysis = freshTrace.analysis;
        void this.resolveTargetMetierLabel();
      } else {
        const fresh = await this.cvSubmissionService.fetchMatchingAnalysis(false);
        if (fresh) {
          this.analysis = fresh;
          void this.resolveTargetMetierLabel();
        }
      }
    } catch (err) {
      console.error('Matching analysis/trace fetch failed:', err);
      if (!this.analysis) {
        this.errorMessage = 'Impossible de charger votre analyse matching/gap pour le moment.';
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async refresh(force = true): Promise<void> {
    if (this.refreshing) return;

    this.refreshing = true;
    this.errorMessage = '';

    try {
      const freshTrace = await this.cvSubmissionService.fetchMatchingAnalysisTrace(force);
      if (freshTrace) {
        this.trace = freshTrace;
        this.analysis = freshTrace.analysis;
        void this.resolveTargetMetierLabel();
      } else {
        const fresh = await this.cvSubmissionService.fetchMatchingAnalysis(force);
        if (fresh) {
          this.analysis = fresh;
          void this.resolveTargetMetierLabel();
        }
      }
    } catch (err) {
      console.error('Matching analysis refresh failed:', err);
      this.errorMessage = 'Echec du recalcul matching/gap. Verifiez le service Python.';
    } finally {
      this.refreshing = false;
      this.cdr.markForCheck();
    }
  }

  scorePercent(score: number): string {
    const value = Number(score);
    const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    return `${(clamped * 100).toFixed(1)}%`;
  }

  coveragePercent(value: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  gapSeverity(score: number): string {
    if (score >= 0.65) return 'Faible';
    if (score >= 0.5) return 'Moyen';
    return 'Critique';
  }

  gapSeverityClass(score: number): string {
    if (score >= 0.65) return 'severity-low';
    if (score >= 0.5) return 'severity-medium';
    return 'severity-high';
  }

  private normalizeMetierId(value: unknown): string {
    if (value === undefined || value === null) return '';

    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }

    if (typeof value === 'object') {
      const oid = (value as any)?.$oid;
      if (typeof oid === 'string') {
        return oid.trim().toLowerCase();
      }

      const toHexString = (value as any)?.toHexString;
      if (typeof toHexString === 'function') {
        try {
          const hex = String(toHexString.call(value)).trim().toLowerCase();
          if (hex) return hex;
        } catch {
          // ignore invalid object-id transforms
        }
      }
    }

    return String(value).trim().toLowerCase();
  }

  private normalizeMetierLabel(value: unknown): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokenizeMetierLabel(value: string): string[] {
    const normalized = this.normalizeMetierLabel(value);
    if (!normalized) return [];
    return normalized.split(' ').filter((token) => token.length > 1);
  }

  private isLikelyMetierIdentifier(value: string): boolean {
    return /^metier_[a-z0-9_-]+$/i.test(value) || /^[a-f0-9]{24}$/i.test(value);
  }

  private metierMatchesRef(refMetier: string, targetNormalized: string): boolean {
    const refNormalized = this.normalizeMetierLabel(refMetier);
    if (!refNormalized || !targetNormalized) return false;

    if (
      refNormalized === targetNormalized
      || refNormalized.includes(targetNormalized)
      || targetNormalized.includes(refNormalized)
    ) {
      return true;
    }

    const refTokens = this.tokenizeMetierLabel(refNormalized);
    const targetTokens = this.tokenizeMetierLabel(targetNormalized);
    if (!refTokens.length || !targetTokens.length) return false;

    const targetSet = new Set(targetTokens);
    let overlap = 0;
    for (const token of refTokens) {
      if (targetSet.has(token)) overlap += 1;
    }

    return overlap >= 2;
  }

  private async loadMetierLookupIfNeeded(): Promise<void> {
    if (this.metierLookupLoaded) return;
    this.metierLookupLoaded = true;

    try {
      const metiers = await this.cvSubmissionService.fetchMetiers();
      for (const metier of metiers) {
        const id = this.normalizeMetierId(metier?._id);
        const label = String(metier?.nom_metier ?? metier?.nom ?? '').trim();

        if (id && label) {
          this.metierLabelById.set(id, label);
        }
      }
    } catch (err) {
      console.warn('Failed to load metier lookup for target gap display:', err);
    }
  }

  private async resolveTargetMetierLabel(): Promise<void> {
    const selectedMetierId = this.normalizeMetierId(this.analysis?.selectedMetierId);

    if (!selectedMetierId) {
      this.targetMetierLabel = '';
      this.cdr.markForCheck();
      return;
    }

    let nextLabel = '';

    await this.loadMetierLookupIfNeeded();

    const resolved = this.metierLabelById.get(selectedMetierId);
    if (resolved) {
      nextLabel = resolved;
    } else {
      try {
        const cv = await this.cvSubmissionService.fetchMyCv(selectedMetierId);
        const profileTitle = String(cv?.professionalTitle ?? '').trim();
        if (profileTitle.length > 0) {
          nextLabel = profileTitle;
        }
      } catch {
        // ignore profile lookup failures and continue with local fallback
      }

      if (!nextLabel) {
        nextLabel = this.isLikelyMetierIdentifier(selectedMetierId)
          ? ''
          : selectedMetierId;
      }
    }

    this.targetMetierLabel = nextLabel;
    this.cdr.markForCheck();
  }

  private getMetierCardsSource(): DisplayMetierCard[] {
    const traceRows = this.trace?.metierScores ?? [];
    if (traceRows.length > 0) {
      return traceRows.map((row) => ({
        metier: row.metierName,
        domaine: row.domaineName,
        coveragePct: row.coveragePct,
        matched: row.matchedCompetences,
        nCompetences: row.nCompetences,
        avgScore: row.avgScore,
        topSkills: row.topSkills,
      }));
    }

    const ranking = this.analysis?.metierRanking ?? [];
    return ranking.map((entry: MatchingMetierRankingEntry) => ({
      metier: entry.metier,
      domaine: entry.domaine,
      coveragePct: entry.coveragePct,
      matched: entry.matched,
      nCompetences: entry.nCompetences,
      avgScore: entry.avgScore,
      topSkills: entry.topSkills,
    }));
  }

  private getGapRowsSource(): DisplayGapRow[] {
    const traceRows = this.trace?.competenceResults ?? [];
    if (traceRows.length > 0) {
      return traceRows
        .filter((row) => row.status === 'gap')
        .map((row) => ({
          refCompetence: row.competenceName,
          refMetier: row.metierName,
          refDomaine: row.domaineName,
          similarityScore: row.similarityScore,
        }));
    }

    const allGaps = this.analysis?.gaps ?? [];
    const source = allGaps.length > 0
      ? allGaps
      : (this.analysis?.topMetierGaps ?? []);

    return source.map((entry: MatchingGapEntry) => ({
      refCompetence: entry.refCompetence,
      refMetier: entry.refMetier,
      refDomaine: entry.refDomaine,
      similarityScore: entry.similarityScore,
    }));
  }

  get displayedMetiers(): DisplayMetierCard[] {
    return this.getMetierCardsSource().slice(0, 6);
  }

  get topMetiers(): DisplayMetierCard[] {
    return this.displayedMetiers;
  }

  get displayedGaps(): DisplayGapRow[] {
    return this.getGapRowsSource();
  }

  get topThreeMatchingMetiers(): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of this.topMetiers) {
      const label = String(item?.metier ?? '').trim();
      const normalized = this.normalizeMetierLabel(label);
      if (!normalized || seen.has(normalized)) continue;

      seen.add(normalized);
      result.push(label);

      if (result.length >= 3) break;
    }

    return result;
  }

  get displayedTargetMetierGaps(): DisplayGapRow[] {
    const source = this.displayedGaps;
    const targetNormalized = this.normalizeMetierLabel(this.targetMetierLabel);

    if (!targetNormalized) return [];

    return source
      .filter((gap) => this.metierMatchesRef(gap.refMetier, targetNormalized))
      .slice(0, 20);
  }

  get displayedTopThreeMetierGaps(): DisplayGapRow[] {
    const source = this.displayedGaps;
    const topThreeNormalized = this.topThreeMatchingMetiers
      .map((label) => this.normalizeMetierLabel(label))
      .filter((label) => label.length > 0);

    if (!topThreeNormalized.length) return [];

    return source
      .filter((gap) => topThreeNormalized.some((label) => this.metierMatchesRef(gap.refMetier, label)))
      .slice(0, 48);
  }

  get targetMetierEmptyMessage(): string {
    if (!this.targetMetierLabel) {
      return 'Métier visé introuvable dans les données analysées. Vérifiez le métier choisi dans le profil CV.';
    }
    return `Aucun gap prioritaire trouvé pour le métier visé: ${this.targetMetierLabel}.`;
  }

  trackByMetier(_: number, item: DisplayMetierCard): string {
    return `${item.metier}::${item.domaine}`;
  }

  trackByGap(_: number, item: DisplayGapRow): string {
    return `${item.refMetier}::${item.refCompetence}`;
  }
}
