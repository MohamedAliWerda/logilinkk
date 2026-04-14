import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CvSubmissionService } from '../cv-ats/cv-submission.service';
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

    // métiers compatibles: number of matching companies
    const metiers = this.matchingCompanies ? this.matchingCompanies.length : 0;

    // nbre de gaps: count of skills with a positive gap
    const nbreGaps = this.skills ? this.skills.filter(s => (s.required - s.current) > 0).length : 0;

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
