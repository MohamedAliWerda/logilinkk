import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import {
  CvSubmissionService,
  MatchingAnalysisResponse,
  MatchingAnalysisTraceResponse,
} from '../cv-ats/cv-submission.service';
// dashboard does not render the global navbar/sidebar (those are provided by Home)

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard {
  studentName = 'Nour';
  sidebarCollapsed = false;
  activeMenu = 'dashboard';
  matchingSearch = '';

  // UI state
  stats: { label: string; value: number; icon: SafeHtml }[];
  employabilityScore = 0;
  recommendations: string[] = [];
  atsScoreFromApi: number | null = null;
  employabilityScoreFromApi: number | null = null;
  private matchingAnalysis: MatchingAnalysisResponse | null = null;
  private matchingTrace: MatchingAnalysisTraceResponse | null = null;
  private targetMetierLabel = '';
  private compatibleMetiersCount = 0;
  private targetMetierGapsCount = 0;
  private readonly matchStatusThreshold = 0.6;
  private metierLookupLoaded = false;
  private readonly metierLabelById = new Map<string, string>();

  constructor(
    private router: Router,
    private sanitizer: DomSanitizer,
    private cvSubmissionService: CvSubmissionService,
    private cdr: ChangeDetectorRef,
  ) {
    this.studentName = this.resolveStudentName();

    const icons = [
      // star – Score CV
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="#fca63a">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>`,
      // building – Entreprises matchées
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca63a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18M9 21V9"/>
      </svg>`,
      // open book – Formations suggérées
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca63a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>`,
      // chart – Gaps identifiés
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fca63a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>`,
    ];
    this.stats = [
      { label: 'Score ATS',             value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[0]) },
      { label: "Score employabilité", value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[1]) },
      { label: 'Métiers compatibles',    value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[2]) },
      { label: 'Nbre de gaps',          value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[3]) },
    ];

    // basic recommendations (placeholder data)
    this.recommendations = [
      'Formation SAP - Niveau débutant',
      'Anglais professionnel - Conversation',
      'Gestion des stocks avancée',
      'Certification supply chain',
      'Atelier optimisation processus',
    ];

    // compute initial score/stats
    this.employabilityScore = this.getAvgMatchScore();
    this.recomputeStats();
    void this.loadAtsScore();
    void this.loadEmployabilityScore();
    void this.loadMatchingStats();
  }

  private async loadMatchingStats(): Promise<void> {
    const cachedTrace = this.cvSubmissionService.getCachedMatchingAnalysisTrace();
    if (cachedTrace) {
      this.matchingTrace = cachedTrace;
      this.matchingAnalysis = cachedTrace.analysis;
      await this.refreshMatchingKpis();
      this.cdr.detectChanges();
    } else {
      const cached = this.cvSubmissionService.getCachedMatchingAnalysis();
      if (cached) {
        this.matchingAnalysis = cached;
        await this.refreshMatchingKpis();
        this.cdr.detectChanges();
      }
    }

    try {
      const freshTrace = await this.cvSubmissionService.fetchMatchingAnalysisTrace(false);
      if (freshTrace) {
        this.matchingTrace = freshTrace;
        this.matchingAnalysis = freshTrace.analysis;
      } else {
        const fresh = await this.cvSubmissionService.fetchMatchingAnalysis(false);
        if (fresh) {
          this.matchingAnalysis = fresh;
        }
      }

      await this.refreshMatchingKpis();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Dashboard matching stats fetch failed', err);
    }
  }

  private async refreshMatchingKpis(): Promise<void> {
    await this.resolveTargetMetierLabel();
    this.compatibleMetiersCount = this.countCompatibleMetiers();
    this.targetMetierGapsCount = this.countTargetMetierGaps();
    this.recomputeStats();
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
      console.warn('Dashboard metier lookup fetch failed', err);
    }
  }

  private async resolveTargetMetierLabel(): Promise<void> {
    const selectedMetierId = this.normalizeMetierId(this.matchingAnalysis?.selectedMetierId);

    if (!selectedMetierId) {
      this.targetMetierLabel = '';
      return;
    }

    await this.loadMetierLookupIfNeeded();

    let nextLabel = this.metierLabelById.get(selectedMetierId) ?? '';

    if (!nextLabel) {
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
  }

  private countCompatibleMetiers(): number {
    const traceMatchedScoresByMetier = this.collectTraceMatchedScoresByMetier();
    const analysisMatchedScoresByMetier = this.collectAnalysisMatchedScoresByMetier();

    const traceRows = this.matchingTrace?.metierScores ?? [];
    if (traceRows.length > 0) {
      return traceRows.filter((entry) => {
        const fallbackMatchedScores = this.collectFallbackMatchedScores(entry.topSkills);
        const matchedScores = this.resolveMetierMatchedScores(
          entry.metierName,
          fallbackMatchedScores,
          traceMatchedScoresByMetier,
          analysisMatchedScoresByMetier,
        );

        const coveragePct = this.computeCoveragePctFromMatchedSimilarity(
          matchedScores,
          entry.nCompetences,
          entry.coveragePct,
        );

        return coveragePct >= 50;
      }).length;
    }

    const ranking = this.matchingAnalysis?.metierRanking ?? [];
    return ranking.filter((entry) => {
      const fallbackMatchedScores = this.collectFallbackMatchedScores(entry.topSkills);
      const matchedScores = this.resolveMetierMatchedScores(
        entry.metier,
        fallbackMatchedScores,
        traceMatchedScoresByMetier,
        analysisMatchedScoresByMetier,
      );

      const coveragePct = this.computeCoveragePctFromMatchedSimilarity(
        matchedScores,
        entry.nCompetences,
        entry.coveragePct,
      );

      return coveragePct >= 50;
    }).length;
  }

  private collectFallbackMatchedScores(
    topSkills: Array<{ score: number }> | null | undefined,
  ): number[] {
    const scores: number[] = [];

    for (const skill of topSkills ?? []) {
      const score = Number(skill?.score);
      if (!Number.isFinite(score) || score < this.matchStatusThreshold) continue;
      scores.push(score);
    }

    return scores;
  }

  private collectTraceMatchedScoresByMetier(): Map<string, number[]> {
    const grouped = new Map<string, number[]>();

    for (const entry of this.matchingTrace?.competenceResults ?? []) {
      if (entry.status !== 'match') continue;

      const metierKey = this.normalizeMetierLabel(entry.metierName);
      const score = Number(entry.similarityScore);
      if (!metierKey || !Number.isFinite(score)) continue;

      const bucket = grouped.get(metierKey) ?? [];
      bucket.push(score);
      grouped.set(metierKey, bucket);
    }

    return grouped;
  }

  private collectAnalysisMatchedScoresByMetier(): Map<string, number[]> {
    const grouped = new Map<string, number[]>();

    for (const entry of this.matchingAnalysis?.matches ?? []) {
      const metierKey = this.normalizeMetierLabel(entry.refMetier);
      const score = Number(entry.similarityScore);
      if (!metierKey || !Number.isFinite(score)) continue;

      const bucket = grouped.get(metierKey) ?? [];
      bucket.push(score);
      grouped.set(metierKey, bucket);
    }

    return grouped;
  }

  private resolveMetierMatchedScores(
    metierName: string,
    fallbackScores: number[],
    traceMap: Map<string, number[]>,
    analysisMap: Map<string, number[]>,
  ): number[] {
    const normalizedMetier = this.normalizeMetierLabel(metierName);
    if (!normalizedMetier) return fallbackScores;

    const fromTrace = traceMap.get(normalizedMetier) ?? [];
    if (fromTrace.length > 0) return fromTrace;

    const fromAnalysis = analysisMap.get(normalizedMetier) ?? [];
    if (fromAnalysis.length > 0) return fromAnalysis;

    return fallbackScores;
  }

  private computeCoveragePctFromMatchedSimilarity(
    matchedScores: number[],
    nCompetences: number,
    fallbackPct: number,
  ): number {
    const totalCompetences = Number(nCompetences);

    if (Number.isFinite(totalCompetences) && totalCompetences > 0) {
      const similaritySum = matchedScores.reduce((sum, score) => {
        const value = Number(score);
        if (!Number.isFinite(value)) return sum;
        return sum + Math.max(0, Math.min(1, value));
      }, 0);

      return Number(Math.max(0, Math.min(100, (similaritySum / totalCompetences) * 100)).toFixed(1));
    }

    const fallback = Number(fallbackPct);
    if (!Number.isFinite(fallback)) return 0;
    return Number(Math.max(0, Math.min(100, fallback)).toFixed(1));
  }

  private getGapRowsSource(): Array<{ refMetier: string }> {
    const traceRows = this.matchingTrace?.competenceResults ?? [];
    if (traceRows.length > 0) {
      return traceRows
        .filter((row) => row.status === 'gap')
        .map((row) => ({
          refMetier: row.metierName,
        }));
    }

    const allGaps = this.matchingAnalysis?.gaps ?? [];
    const source = allGaps.length > 0
      ? allGaps
      : (this.matchingAnalysis?.topMetierGaps ?? []);

    return source.map((entry) => ({
      refMetier: entry.refMetier,
    }));
  }

  private countTargetMetierGaps(): number {
    const targetNormalized = this.normalizeMetierLabel(this.targetMetierLabel);
    if (!targetNormalized) return 0;

    return this.getGapRowsSource()
      .filter((gap) => this.metierMatchesRef(gap.refMetier, targetNormalized))
      .length;
  }

  private scoreFromStorage(): number | null {
    const raw = localStorage.getItem('latestAtsScore');
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  private async loadAtsScore(): Promise<void> {
    const local = this.scoreFromStorage();
    if (local !== null) {
      this.atsScoreFromApi = local;
      this.recomputeStats();
    }

    try {
      const cv = await this.cvSubmissionService.fetchMyCv();
      if (cv?.atsScore === undefined || cv?.atsScore === null) return;

      const score = Math.max(0, Math.min(100, Math.round(Number(cv.atsScore) || 0)));
      this.atsScoreFromApi = score;
      localStorage.setItem('latestAtsScore', String(score));
      this.recomputeStats();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Dashboard ATS score fetch failed', err);
    }
  }

  private async loadEmployabilityScore(): Promise<void> {
    try {
      const result = await this.cvSubmissionService.fetchMyEmployabilityScore();
      this.employabilityScoreFromApi = (result.found && result.scoreFinal !== null)
        ? result.scoreFinal
        : 0;
      this.recomputeStats();
      this.cdr.detectChanges();
    } catch (err) {
      console.error('Dashboard employability score fetch failed', err);
      this.employabilityScoreFromApi = 0;
      this.recomputeStats();
      this.cdr.detectChanges();
    }
  }

  private resolveStudentName(): string {
    const formatNameFromEmail = (email: string): string => {
      const local = email.split('@')[0] ?? '';
      const parts = local.split(/[._-]+/).filter(Boolean);
      if (parts.length === 0) return 'Etudiant';
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    };

    try {
      const raw = localStorage.getItem('user');
      if (!raw) return 'Etudiant';

      const user = JSON.parse(raw) as Record<string, unknown> | null;
      if (!user) return 'Etudiant';

      if (typeof user['prenom'] === 'string' || typeof user['nom'] === 'string') {
        const fullName = `${String(user['prenom'] ?? '')} ${String(user['nom'] ?? '')}`.trim();
        if (fullName.length > 0) return fullName;
      }

      if (typeof user['displayName'] === 'string' && user['displayName'].trim().length > 0) {
        return user['displayName'];
      }

      if (typeof user['firstName'] === 'string' || typeof user['lastName'] === 'string') {
        const fullName = `${String(user['firstName'] ?? '')} ${String(user['lastName'] ?? '')}`.trim();
        if (fullName.length > 0) return fullName;
      }

      if (typeof user['email'] === 'string' && user['email'].trim().length > 0) {
        return formatNameFromEmail(user['email']);
      }

      return 'Etudiant';
    } catch {
      return 'Etudiant';
    }
  }

  companies = [
    { name: 'Sotrapil', location: 'Sfax', sector: 'Transport pétrolier', match: 92 },
    { name: 'CTN',      location: 'Tunis', sector: 'Transport maritime', match: 87 },
  ];

  skills = [
    { name: 'SAP ERP',               current: 30, required: 80 },
    { name: 'Gestion des stocks',    current: 55, required: 90 },
    { name: 'Anglais professionnel', current: 60, required: 85 },
  ];

  matchingCompanies = [
    {
      name: 'Sotrapil',
      location: 'Sfax',
      score: 92,
      description: 'Leader tunisien du transport de produits petroliers par pipeline.',
      tags: ['Logistique', 'Transport', 'SAP'],
      sector: 'Transport petrolier',
      employees: '500+ employes',
      stage: 'Stage PFE',
    },
    {
      name: 'CTN',
      location: 'Tunis',
      score: 87,
      description: 'Compagnie nationale de navigation maritime.',
      tags: ['Maritime', 'Supply Chain', 'Commerce international'],
      sector: 'Transport maritime',
      employees: '1000+ employes',
      stage: 'Stage PFE',
    },
    {
      name: 'Tunisie Telecom',
      location: 'Tunis',
      score: 80,
      description: 'Optimisation des operations supply chain et logistique telecom.',
      tags: ['Supply Chain', 'Data', 'ERP'],
      sector: 'Telecommunications',
      employees: '2000+ employes',
      stage: 'Stage ingenieur',
    },
    {
      name: 'STAM',
      location: 'Rades',
      score: 84,
      description: 'Gestion portuaire, transit et operations de manutention.',
      tags: ['Portuaire', 'Transport', 'Operations'],
      sector: 'Logistique portuaire',
      employees: '700+ employes',
      stage: 'Stage technicien',
    },
  ];

  get filteredMatchingCompanies() {
    const q = this.matchingSearch.trim().toLowerCase();
    if (!q) return this.matchingCompanies;
    return this.matchingCompanies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)) ||
      c.sector.toLowerCase().includes(q)
    );
  }

  /**
   * Returns a CSS conic-gradient value to render the radial meter.
   */
  getConicdeg(score: number) {
    const s = Math.max(0, Math.min(100, Math.round(score)));
    const color = '#fca63a'; // use the project's orange for the radial fill
    return `conic-gradient(${color} ${s}%, #eef3f8 ${s}% 100%)`;
  }

  getEmployabilityDescription(score: number) {
    const s = Math.max(0, Math.min(100, Math.round(score)));
    if (s >= 80) {
      return `Votre score de ${s}/100 reflète un excellent niveau de compétences techniques et un profil solide. Vous êtes bien positionné pour des opportunités avancées ; le maintien et la spécialisation de compétences clés (outils digitaux et expérience terrain) permettront d'augmenter encore votre attractivité.`;
    }
    if (s >= 60) {
      return `Votre score de ${s}/100 reflète un bon niveau de compétences techniques de base, avec un profil linguistique favorable. Cependant, des lacunes existent sur certains outils digitaux (par ex. SAP, WMS, Power BI) et en expérience professionnelle. Le renforcement de ces domaines pourrait significativement améliorer votre employabilité.`;
    }
    if (s >= 40) {
      return `Votre score de ${s}/100 indique des compétences de base mais des écarts importants subsistent. Nous recommandons des formations ciblées (outils digitaux, certifications sectorielles) et des expériences pratiques pour améliorer rapidement votre employabilité.`;
    }
    return `Votre score de ${s}/100 montre qu'il est nécessaire d'intervenir sur plusieurs axes : renforcement des compétences techniques, acquisition d'expérience pratique et apprentissage d'outils digitaux (SAP, WMS, Power BI). Des actions ciblées augmenteront significativement vos chances sur le marché du travail.`;
  }

  getAvgMatchScore() {
    if (!this.matchingCompanies || this.matchingCompanies.length === 0) return 0;
    const sum = this.matchingCompanies.reduce((acc, c) => acc + (c.score || 0), 0);
    return Math.round(sum / this.matchingCompanies.length);
  }

  getGapPercent(s: { current: number; required: number }) {
    if (!s || !s.required) return 0;
    const gap = Math.max(0, s.required - s.current);
    return Math.round((gap / s.required) * 100);
  }

  /** Recompute KPI stat values to reflect current data. */
  recomputeStats() {
    // ATS score: average coverage of required skill levels
    const calculatedAts = this.skills && this.skills.length
      ? Math.round(
          (this.skills.reduce((acc, s) => acc + Math.min(1, s.current / (s.required || 1)), 0) / this.skills.length) * 100
        )
      : 0;
    const ats = this.atsScoreFromApi ?? calculatedAts;

    // employability score: backend persisted score only (no local fallback)
    this.employabilityScore = this.employabilityScoreFromApi ?? 0;

    // métiers compatibles: count of metiers with matching score >= 50
    const metiers = this.compatibleMetiersCount;

    // nbre de gaps: count of gaps for the selected target metier only
    const nbreGaps = this.targetMetierGapsCount;

    // assign into stats array in consistent order
    if (this.stats && this.stats.length >= 4) {
      this.stats[0].value = ats;
      this.stats[1].value = Number(this.employabilityScore.toFixed(2));
      this.stats[2].value = metiers;
      this.stats[3].value = nbreGaps;
    }
  }

  logout() {
    this.router.navigate(['/']);
  }

  setMenu(menu: string) {
    this.activeMenu = menu;
  }

  goToProfil() {
    this.router.navigate(['/profil']);
  }

  goToCvAts() {
    this.setMenu('cv');
    this.router.navigate(['/cv-ats']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
