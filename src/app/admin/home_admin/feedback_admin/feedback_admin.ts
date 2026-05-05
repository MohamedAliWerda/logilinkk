import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import Chart from 'chart.js/auto';
import { SupabaseService } from '../../../services/supabase.service';

interface OldStudent {
  id: string;
  fullName: string;
  email: string;
  promotion: number;
  status: 'À répondu' | 'Non contacté' | 'Invité';
  company?: string;
  position?: string;
  rating?: number;
  employmentStatus?: 'CDI' | 'CDD / SIVP' | 'Freelance' | 'À l\'étranger (emploi)' | 'Formation supérieure' | 'Recherche active' | 'Inactif';
  salaryRange?: '< 800 TND' | '800-1200 TND' | '1200-1800 TND' | '1800-2500 TND' | '> 2500 TND';
  firstJobDelay?: 'Avant diplomation' | '< 1 mois' | '1 à 3 mois' | '3 à 6 mois' | '6 à 12 mois' | 'Plus de 12 mois' | 'Encore en recherche';
  recommendationNote?: number;
  recruitmentChannel?: 'LinkedIn' | 'Réseau personnel' | 'Portail emploi' | 'Bureau ISGIS' | 'Candidature spont.' | 'Salon emploi';
  adequation?: 'Totalement en lien' | 'Partiellement en lien' | 'Pas du tout en lien';
  competenceFeedback?: string[];
  feedbackDate?: string;
}

interface StatCard {
  value: string;
  label: string;
  icon?: string;
}

@Component({
  selector: 'app-feedback-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feedback_admin.html',
  styleUrl: './feedback_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('300ms ease-in', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class FeedbackAdmin implements AfterViewInit, OnDestroy, OnInit {
  searchTerm: string = '';
  sortColumn: string = '';
  sortDirection: 'asc' | 'desc' = 'asc';
  activeTab: 'anciens' | 'retours' = 'anciens';
  selectedPromo: number | null = null;
  private chartInstances: Record<string, Chart | undefined> = {};
  private dashboardUpdatedAt: Date = new Date();

  showProfileModal: boolean = false;
  selectedStudent: OldStudent | null = null;
  showAddStudentModal: boolean = false;
  newStudentForm = {
    fullName: '',
    email: '',
    promotion: '',
  };

  // Email Modal
  showSendEmailModal: boolean = false;
  emailSubject: string = 'Partagez votre expérience professionnelle - ISGI';
  emailMessage: string = `Chère ancienne diplômée / Cher ancien diplômé,

Nous aimerions connaître votre parcours professionnel et recueillir vos retours sur votre expérience à l'ISGI.

Votre avis nous est précieux pour continuer à améliorer notre programme de formation.

Nous vous invitons à répondre à quelques questions en cliquant sur le lien ci-dessous:

[Lien vers le formulaire]

Cordialement,
L'équipe ISGI`;

  showSuccessNotification: boolean = false;
  successMessage: string = '';
  feedbackStudents: OldStudent[] = [];
  private refreshIntervalId: number | undefined;

  constructor(
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    void this.refreshAllData();
    this.refreshIntervalId = window.setInterval(() => {
      void this.refreshAllData();
    }, 15000);
  }

  private async refreshAllData(): Promise<void> {
    await this.loadAncienEtudiants(false);
    await this.loadDashboardFeedback(false);
    this.cdr.markForCheck();
    this.scheduleDashboardCharts();
  }

  private async loadAncienEtudiants(shouldRefreshCharts = true): Promise<void> {
    try {
      const rows = await this.supabaseService.fetchFeedback('ancien_etudiant');
      if (!rows) {
        return;
      }

      const mapped: OldStudent[] = (rows as any[]).map(r => this.mapRowToOldStudent(r));
      this.oldStudents = mapped;
      if (shouldRefreshCharts) {
        this.cdr.markForCheck();
        this.scheduleDashboardCharts();
      }
    } catch (err) {
      console.error('Supabase fetch error', err);
      throw err;
    }
  }

  private async loadDashboardFeedback(shouldRefreshCharts = true): Promise<void> {
    try {
      const rows = await this.supabaseService.fetchFeedback('feedback');
      if (!rows) {
        return;
      }

      const mapped: OldStudent[] = (rows as any[]).map(r => this.mapFeedbackRowToStudent(r));
      this.feedbackStudents = mapped;
      if (shouldRefreshCharts) {
        this.cdr.markForCheck();
        this.scheduleDashboardCharts();
      }
    } catch (err) {
      console.error('Supabase feedback fetch error', err);
      throw err;
    }
  }

  private mapRowToOldStudent(row: any): OldStudent {
    // Prefer actual column names from Supabase `ancien_etudiant` (may contain spaces/accents)
    const id = row.id ?? row.ID ?? row['ID'] ?? `${row.EMAIL ?? row.email ?? 'unknown'}-${row.PROMOTION ?? row.promotion ?? ''}`;
    const namePart = `${row.prenom ?? row.PRENOM ?? ''} ${row.nom ?? row.NOM ?? ''}`.trim();
    const nameCandidate = row.NOM ?? namePart;
    const fullName = row.full_name ?? row.name ?? (nameCandidate || row.EMAIL || row.email || id);
    const email = row.email ?? row.EMAIL ?? row.mail ?? row.MAIL ?? '';

    // Promotion: try parse year from various formats (date or year string)
    let promotionRaw = row.promotion ?? row.PROMOTION ?? row.annee ?? row.promo ?? '';
    let promotion = 0;
    if (promotionRaw) {
      const asDate = new Date(promotionRaw);
      if (!isNaN(asDate.getTime())) {
        promotion = asDate.getFullYear();
      } else {
        const yearMatch = String(promotionRaw).match(/(20\d{2}|19\d{2})/);
        promotion = yearMatch ? Number(yearMatch[0]) : Number(promotionRaw) || 0;
      }
    }

    // Status detection using columns like 'STATUT INVITATION' and 'RÉPONSE'
    const statutInv = (row['STATUT INVITATION'] ?? row['STATUT_INVITATION'] ?? row.statut ?? row.status ?? '').toString().toLowerCase();
    const reponseCol = (row['RÉPONSE'] ?? row['REPONSE'] ?? row.response ?? row.reponse ?? '').toString().toLowerCase();
    let status: OldStudent['status'] = 'Non contacté';
    if (reponseCol.includes('répon') || reponseCol.includes('repon') || reponseCol.includes('répondu') || reponseCol.includes('repondu')) {
      status = 'À répondu';
    } else if (statutInv.includes('invit') || statutInv.includes('invité')) {
      status = 'Invité';
    } else if (statutInv.includes('non') || statutInv.includes('non invit')) {
      status = 'Non contacté';
    }

    const employmentStatus = (row.employment_status ?? row['STATUT EMPLOI'] ?? row['STATUT_EMPLOI'] ?? row.statut_emploi) as OldStudent['employmentStatus'];
    const salaryRange = (row.salary_range ?? row['FOURCHETTE SALARIALE'] ?? row.salaire) as OldStudent['salaryRange'];
    const firstJobDelay = (row.first_job_delay ?? row['DELAI PREMIER EMPLOI'] ?? row.delai_premier_emploi) as OldStudent['firstJobDelay'];
    const recommendationNote = Number(row.recommendation_note ?? row['NOTE RECOMMANDATION'] ?? row.note_recommandation ?? row.note) || undefined;
    const recruitmentChannel = (row.recruitment_channel ?? row['CANAL RECRUTEMENT'] ?? row.canal_recrutement) as OldStudent['recruitmentChannel'];
    const adequation = (row.adequation ?? row['ADEQUATION'] ?? row.adequation_fr) as OldStudent['adequation'];
    const competenceFeedback = row.competence_feedback ? (typeof row.competence_feedback === 'string' ? JSON.parse(row.competence_feedback) : row.competence_feedback) : (row.competences ?? row.COMPETENCES ?? []);
    const feedbackDate = row.feedback_date ?? row['FEEDBACK_DATE'] ?? row.created_at ?? row.date ?? row.PROMOTION;

    return {
      id: String(id),
      fullName: String(fullName),
      email: String(email),
      promotion,
      status,
      company: row.company ?? row.entreprise,
      position: row.position ?? row.job_title,
      rating: row.rating ? Number(row.rating) : undefined,
      employmentStatus,
      salaryRange,
      firstJobDelay,
      recommendationNote,
      recruitmentChannel,
      adequation,
      competenceFeedback,
      feedbackDate,
    };
  }

  private mapFeedbackRowToStudent(row: any): OldStudent {
    const id = row.id ?? row.ID ?? `${row.email ?? row.EMAIL ?? 'unknown'}-${row.promotion ?? row.PROMOTION ?? ''}`;
    const fullName = row.nom_prenom ?? row.NOM ?? row.full_name ?? row.name ?? row.email ?? row.EMAIL ?? id;
    const email = row.email ?? row.EMAIL ?? '';

    let promotion = 0;
    const promotionRaw = row.promotion ?? row.PROMOTION ?? '';
    if (promotionRaw) {
      const yearMatch = String(promotionRaw).match(/(20\d{2}|19\d{2})/);
      promotion = yearMatch ? Number(yearMatch[0]) : Number(promotionRaw) || 0;
    }

    const situation = String(row.situation_actuelle ?? '').toLowerCase();
    let employmentStatus: OldStudent['employmentStatus'] = 'Inactif';
    if (situation.includes('cdi')) {
      employmentStatus = 'CDI';
    } else if (situation.includes('cdd') || situation.includes('sivp')) {
      employmentStatus = 'CDD / SIVP';
    } else if (situation.includes('freelance')) {
      employmentStatus = 'Freelance';
    } else if (situation.includes('étranger') || situation.includes('etranger')) {
      employmentStatus = 'À l\'étranger (emploi)';
    } else if (situation.includes('formation')) {
      employmentStatus = 'Formation supérieure';
    } else if (situation.includes('recherche')) {
      employmentStatus = 'Recherche active';
    }

    const salaryText = String(row.salaire_brut_mensuel ?? '').toLowerCase();
    let salaryRange: OldStudent['salaryRange'] = '< 800 TND';
    if (salaryText.includes('800') && salaryText.includes('1 200')) {
      salaryRange = '800-1200 TND';
    } else if (salaryText.includes('1200') || salaryText.includes('1 200')) {
      salaryRange = '1200-1800 TND';
    } else if (salaryText.includes('1800') || salaryText.includes('2500')) {
      salaryRange = '1800-2500 TND';
    } else if (salaryText.includes('plus') || salaryText.includes('>')) {
      salaryRange = '> 2500 TND';
    }

    const delayText = String(row.delai_premier_emploi ?? '').toLowerCase();
    let firstJobDelay: OldStudent['firstJobDelay'] = 'Encore en recherche';
    if (delayText.includes('avant')) {
      firstJobDelay = 'Avant diplomation';
    } else if (delayText.includes('1 mois') || delayText.includes('< 1')) {
      firstJobDelay = '< 1 mois';
    } else if (delayText.includes('1 à 3') || delayText.includes('1 a 3')) {
      firstJobDelay = '1 à 3 mois';
    } else if (delayText.includes('3 à 6') || delayText.includes('3 a 6')) {
      firstJobDelay = '3 à 6 mois';
    } else if (delayText.includes('6 à 12') || delayText.includes('6 a 12')) {
      firstJobDelay = '6 à 12 mois';
    } else if (delayText.includes('12')) {
      firstJobDelay = 'Plus de 12 mois';
    }

    const recruitmentChannel = (row.canal_efficace ?? row.CANAL_EFFICACE ?? row.canal_recrutement ?? row['CANAL RECRUTEMENT']) as OldStudent['recruitmentChannel'];
    const adequationText = String(row.poste_en_lien_formation ?? '').toLowerCase();
    let adequation: OldStudent['adequation'] = 'Pas du tout en lien';
    if (adequationText.includes('totalement')) {
      adequation = 'Totalement en lien';
    } else if (adequationText.includes('partiellement')) {
      adequation = 'Partiellement en lien';
    }

    const recommendationRaw = row.recommandation_isgis ?? row.RECOMMANDATION_ISGIS ?? row.recommendation_isgis;
    const recommendationNote = Number(recommendationRaw) || undefined;
    const rating = adequation === 'Totalement en lien' ? 5 : adequation === 'Partiellement en lien' ? 3 : 1;

    return {
      id: String(id),
      fullName: String(fullName),
      email: String(email),
      promotion,
      status: 'À répondu',
      company: row.secteur,
      position: row.situation_actuelle,
      rating,
      employmentStatus,
      salaryRange,
      firstJobDelay,
      recommendationNote,
      recruitmentChannel,
      adequation,
      competenceFeedback: [
        row.competences_techniques,
        row.competences_gestion_projet,
        row.competences_numeriques,
        row.competences_communication,
        row.maitrise_langues,
        row.capacite_adaptation,
      ]
        .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
        .map(value => String(value)),
      feedbackDate: row.created_at ?? row.updated_at ?? row.feedback_date,
    };
  }

  oldStudents: OldStudent[] = [];

  private readonly employmentScoreMap: Record<NonNullable<OldStudent['employmentStatus']>, number> = {
    'CDI': 1.0,
    'CDD / SIVP': 0.7,
    'Freelance': 0.8,
    'À l\'étranger (emploi)': 0.9,
    'Formation supérieure': 0.5,
    'Recherche active': 0.0,
    'Inactif': 0.0,
  };

  private readonly employmentMetaMap: Record<NonNullable<OldStudent['employmentStatus']>, { code: string; score: number; isEmployed: boolean }> = {
    'CDI': { code: 'EMPLOYE_STABLE', score: 1.0, isEmployed: true },
    'CDD / SIVP': { code: 'EMPLOYE_PRECAIRE', score: 0.7, isEmployed: true },
    'Freelance': { code: 'INDEPENDANT', score: 0.8, isEmployed: true },
    'À l\'étranger (emploi)': { code: 'EMPLOYE_ETRANGER', score: 0.9, isEmployed: true },
    'Formation supérieure': { code: 'EN_FORMATION', score: 0.5, isEmployed: false },
    'Recherche active': { code: 'CHERCHEUR', score: 0.0, isEmployed: false },
    'Inactif': { code: 'INACTIF', score: 0.0, isEmployed: false },
  };

  private readonly delayScoreMap: Record<NonNullable<OldStudent['firstJobDelay']>, number> = {
    'Avant diplomation': 100,
    '< 1 mois': 95,
    '1 à 3 mois': 80,
    '3 à 6 mois': 60,
    '6 à 12 mois': 35,
    'Plus de 12 mois': 10,
    'Encore en recherche': 0,
  };

  private readonly delayMetaMap: Record<NonNullable<OldStudent['firstJobDelay']>, { delayMonths: number | null; score: number }> = {
    'Avant diplomation': { delayMonths: 0, score: 100 },
    '< 1 mois': { delayMonths: 0.5, score: 95 },
    '1 à 3 mois': { delayMonths: 2, score: 80 },
    '3 à 6 mois': { delayMonths: 4.5, score: 60 },
    '6 à 12 mois': { delayMonths: 9, score: 35 },
    'Plus de 12 mois': { delayMonths: 15, score: 10 },
    'Encore en recherche': { delayMonths: null, score: 0 },
  };

  private readonly adequationScoreMap: Record<NonNullable<OldStudent['adequation']>, number> = {
    'Totalement en lien': 100,
    'Partiellement en lien': 50,
    'Pas du tout en lien': 0,
  };

  private readonly employmentColors: Record<NonNullable<OldStudent['employmentStatus']>, string> = {
    'CDI': '#1D9E75',
    'CDD / SIVP': '#5DCAA5',
    'Freelance': '#7F77DD',
    'À l\'étranger (emploi)': '#2563EB',
    'Formation supérieure': '#F5A623',
    'Recherche active': '#EF4444',
    'Inactif': '#A1A1AA',
  };

  private readonly salaryOrder: NonNullable<OldStudent['salaryRange']>[] = [
    '< 800 TND',
    '800-1200 TND',
    '1200-1800 TND',
    '1800-2500 TND',
    '> 2500 TND',
  ];

  private readonly delayOrder: NonNullable<OldStudent['firstJobDelay']>[] = [
    'Avant diplomation',
    '< 1 mois',
    '1 à 3 mois',
    '3 à 6 mois',
    '6 à 12 mois',
    'Plus de 12 mois',
    'Encore en recherche',
  ];

  private readonly channelOrder: NonNullable<OldStudent['recruitmentChannel']>[] = [
    'LinkedIn',
    'Réseau personnel',
    'Portail emploi',
    'Bureau ISGIS',
    'Candidature spont.',
    'Salon emploi',
  ];

  private distributionRows<T extends string>(
    values: T[],
    order: T[],
    colorResolver: (label: T) => string,
  ): { label: string; count: number; percent: number; color: string }[] {
    const total = values.length;
    const counts = new Map<string, number>();

    values.forEach(value => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });

    return order
      .map(label => {
        const count = counts.get(label) ?? 0;
        return {
          label,
          count,
          percent: total ? Math.round((count / total) * 100) : 0,
          color: colorResolver(label),
        };
      })
      .filter(item => item.count > 0 || total === 0);
  }

  private getEmploymentMeta(student: OldStudent): { code: string; score: number; isEmployed: boolean } {
    return this.employmentMetaMap[student.employmentStatus ?? 'Inactif'];
  }

  private getDelayMeta(student: OldStudent): { delayMonths: number | null; score: number } {
    return this.delayMetaMap[student.firstJobDelay ?? 'Encore en recherche'];
  }

  private getIpeScore(student: OldStudent): number {
    const adequation = student.adequation;
    if (adequation === 'Totalement en lien') {
      return 1;
    }

    if (adequation === 'Partiellement en lien') {
      return 0.5;
    }

    return 0;
  }

  private getRecommendationCategory(note: number): 'promoteur' | 'neutre' | 'detracteur' {
    if (note >= 9) {
      return 'promoteur';
    }

    if (note >= 7) {
      return 'neutre';
    }

    return 'detracteur';
  }

  ngAfterViewInit(): void {
    this.scheduleDashboardCharts();
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId !== undefined) {
      window.clearInterval(this.refreshIntervalId);
      this.refreshIntervalId = undefined;
    }
    this.destroyAllCharts();
  }

  get dashboardLastUpdate(): string {
    return this.dashboardUpdatedAt.toLocaleString('fr-FR');
  }

  private scheduleDashboardCharts(): void {
    if (this.activeTab !== 'retours') {
      return;
    }

    this.dashboardUpdatedAt = new Date();
    setTimeout(() => this.renderDashboardCharts(), 0);
  }

  private destroyAllCharts(): void {
    Object.keys(this.chartInstances).forEach(key => {
      this.chartInstances[key]?.destroy();
      this.chartInstances[key] = undefined;
    });
  }

  private resetChart(key: string): void {
    this.chartInstances[key]?.destroy();
    this.chartInstances[key] = undefined;
  }

  private renderDashboardCharts(): void {
    if (this.activeTab !== 'retours') {
      return;
    }

    this.renderEmploymentStatusChart();
    this.renderSalaryChart();
    this.renderDelayChart();
    this.renderRecruitmentChannelChart();
    this.renderAdequationChart();
  }

  private renderEmploymentStatusChart(): void {
    const canvas = document.getElementById('employment-status-chart') as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    this.resetChart('employment-status');
    this.chartInstances['employment-status'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: this.employmentStatusRows.map(item => item.label),
        datasets: [
          {
            data: this.employmentStatusRows.map(item => item.count),
            backgroundColor: this.employmentStatusRows.map(item => item.color),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '48%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              font: { size: 10 },
            },
          },
        },
      },
    });
  }

  private renderSalaryChart(): void {
    const canvas = document.getElementById('salary-chart') as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    this.resetChart('salary');
    this.chartInstances['salary'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.salaryRows.map(item => item.label),
        datasets: [
          {
            data: this.salaryRows.map(item => item.count),
            backgroundColor: 'rgba(127, 119, 221, 0.35)',
            borderColor: '#7f77dd',
            borderWidth: 1,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { font: { size: 10 }, color: '#71717a' },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            beginAtZero: true,
            ticks: { stepSize: 2, font: { size: 10 }, color: '#71717a' },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });
  }

  private renderDelayChart(): void {
    const canvas = document.getElementById('delay-chart') as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    this.resetChart('delay');
    this.chartInstances['delay'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: this.delayRows.map(item => item.label.length > 14 ? `${item.label.slice(0, 14)}...` : item.label),
        datasets: [
          {
            data: this.delayRows.map(item => item.count),
            backgroundColor: this.delayRows.map((_, index) => `hsl(${155 - index * 15}, 55%, 45%)`),
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { font: { size: 10 }, color: '#71717a' },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
          y: {
            ticks: { font: { size: 10 }, color: '#71717a' },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    });
  }

  private renderRecruitmentChannelChart(): void {
    const canvas = document.getElementById('recruitment-channel-chart') as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    this.resetChart('recruitment-channel');
    this.chartInstances['recruitment-channel'] = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: this.recruitmentChannelRows.map(item => item.label),
        datasets: [
          {
            data: this.recruitmentChannelRows.map(item => item.count),
            backgroundColor: ['#1D9E75', '#7F77DD', '#F5A623', '#2563EB', '#EF4444', '#0EA5E9'],
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              font: { size: 10 },
            },
          },
        },
      },
    });
  }

  private renderAdequationChart(): void {
    const canvas = document.getElementById('adequation-chart') as HTMLCanvasElement | null;
    if (!canvas) {
      return;
    }

    this.resetChart('adequation');
    this.chartInstances['adequation'] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: this.adequationRows.map(item => item.label.replace(' en lien', '')),
        datasets: [
          {
            data: this.adequationRows.map(item => item.count),
            backgroundColor: this.adequationRows.map(item => item.color),
            borderColor: '#ffffff',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '52%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              font: { size: 10 },
            },
          },
        },
      },
    });
  }

  get stats(): StatCard[] {
    const responded = this.oldStudents.filter(s => s.status === 'À répondu').length;
    const invited = this.oldStudents.filter(s => s.status === 'Invité').length;

    return [
      { value: this.oldStudents.length.toString(), label: 'Anciens recensés' },
      { value: invited.toString(), label: 'Invitations envoyées' },
      { value: responded.toString(), label: 'Réponses reçues' },
    ];
  }

  get invitedCount(): number {
    return this.oldStudents.filter(s => s.status === 'Invité').length;
  }

  get respondedCount(): number {
    return this.oldStudents.filter(s => s.status === 'À répondu').length;
  }

  get feedbackCount(): number {
    return this.feedbackStudents.length;
  }

  get responseRate(): number {
    if (!this.oldStudents.length) {
      return 0;
    }

    return Math.round((this.respondedCount / this.oldStudents.length) * 100);
  }

  get promotions(): number[] {
    return [...new Set(this.oldStudents.map(student => student.promotion))].sort((a, b) => a - b);
  }

  get dashboardStudents(): OldStudent[] {
    const respondedStudents = this.feedbackStudents.filter(student => student.status === 'À répondu');

    if (this.selectedPromo === null) {
      return respondedStudents;
    }

    return respondedStudents.filter(student => student.promotion === this.selectedPromo);
  }

  get insertionRate(): number {
    if (!this.dashboardStudents.length) {
      return 0;
    }

    const inserted = this.dashboardStudents.filter(student => this.getEmploymentMeta(student).isEmployed).length;
    return Math.round((inserted / this.dashboardStudents.length) * 100);
  }

  get averageRatingOn5(): string {
    const scores = this.dashboardStudents
      .map(student => this.getIpeScore(student))
      .filter(score => !Number.isNaN(score));

    if (!scores.length) {
      return '-';
    }

    const avg = scores.reduce((sum, value) => sum + value, 0) / scores.length;
    return avg.toFixed(1);
  }

  get averageRating(): number {
    const avg = Number(this.averageRatingOn5);
    return Number.isNaN(avg) ? 0 : Math.round(avg * 100);
  }

  get averageDelayMonths(): string {
    const months = this.dashboardStudents
      .filter(student => this.getEmploymentMeta(student).isEmployed)
      .map(student => this.getDelayMeta(student).delayMonths)
      .filter((month): month is number => month !== null);

    if (!months.length) {
      return '-';
    }

    const avg = months.reduce((sum, value) => sum + value, 0) / months.length;
    return `${avg.toFixed(1)} mois`;
  }

  get employmentStatusRows(): { label: string; count: number; percent: number; color: string }[] {
    const statuses = this.dashboardStudents
      .map(student => student.employmentStatus)
      .filter((status): status is NonNullable<OldStudent['employmentStatus']> => !!status);

    const order = Object.keys(this.employmentScoreMap) as NonNullable<OldStudent['employmentStatus']>[];
    return this.distributionRows(statuses, order, label => this.employmentColors[label]);
  }

  get salaryRows(): { label: string; count: number; percent: number; color: string }[] {
    const rows = this.dashboardStudents
      .map(student => student.salaryRange)
      .filter((salary): salary is NonNullable<OldStudent['salaryRange']> => !!salary);

    return this.distributionRows(rows, this.salaryOrder, () => '#7F77DD');
  }

  get delayRows(): { label: string; count: number; percent: number; color: string }[] {
    const rows = this.dashboardStudents
      .map(student => student.firstJobDelay)
      .filter((delay): delay is NonNullable<OldStudent['firstJobDelay']> => !!delay);

    return this.distributionRows(rows, this.delayOrder, () => '#1D9E75');
  }

  get recruitmentChannelRows(): { label: string; count: number; percent: number; color: string }[] {
    const rows = this.dashboardStudents
      .map(student => student.recruitmentChannel)
      .filter((channel): channel is NonNullable<OldStudent['recruitmentChannel']> => !!channel);

    return this.distributionRows(rows, this.channelOrder, () => '#2563EB');
  }

  get dominantChannel(): string {
    const sorted = [...this.recruitmentChannelRows].sort((a, b) => b.count - a.count);
    return sorted[0]?.label ?? '—';
  }

  get adequationRows(): { label: string; count: number; percent: number; color: string }[] {
    const rows = this.dashboardStudents
      .map(student => student.adequation)
      .filter((adequation): adequation is NonNullable<OldStudent['adequation']> => !!adequation);

    const order: NonNullable<OldStudent['adequation']>[] = ['Totalement en lien', 'Partiellement en lien', 'Pas du tout en lien'];
    const colors: Record<NonNullable<OldStudent['adequation']>, string> = {
      'Totalement en lien': '#1D9E75',
      'Partiellement en lien': '#F5A623',
      'Pas du tout en lien': '#EF4444',
    };

    return this.distributionRows(rows, order, label => colors[label]);
  }

  get weightedEmployabilityScore(): number {
    if (!this.dashboardStudents.length) {
      return 0;
    }

    const scores = this.dashboardStudents.map(student => {
      const employment = student.employmentStatus ? this.getEmploymentMeta(student).score * 100 : 0;
      const delay = student.firstJobDelay ? this.getDelayMeta(student).score : 0;
      const adequation = student.adequation ? this.adequationScoreMap[student.adequation] : 0;

      return (employment * 0.5) + (delay * 0.25) + (adequation * 0.25);
    });

    const total = scores.reduce((sum, score) => sum + score, 0);
    return Math.round(total / scores.length);
  }

  get npsBreakdown(): { promoters: number; neutrals: number; detractors: number } {
    const notes = this.dashboardStudents
      .map(student => student.recommendationNote)
      .filter((note): note is number => typeof note === 'number');

    return {
      promoters: notes.filter(note => this.getRecommendationCategory(note) === 'promoteur').length,
      neutrals: notes.filter(note => this.getRecommendationCategory(note) === 'neutre').length,
      detractors: notes.filter(note => this.getRecommendationCategory(note) === 'detracteur').length,
    };
  }

  get npsScore(): number {
    const notes = this.dashboardStudents
      .map(student => student.recommendationNote)
      .filter((note): note is number => typeof note === 'number');

    if (!notes.length) {
      return 0;
    }

    const promoters = notes.filter(note => this.getRecommendationCategory(note) === 'promoteur').length;
    const detractors = notes.filter(note => this.getRecommendationCategory(note) === 'detracteur').length;
    const promoterPercent = (promoters / notes.length) * 100;
    const detractorPercent = (detractors / notes.length) * 100;
    return Math.round(promoterPercent - detractorPercent);
  }

  get npsLabel(): string {
    if (this.npsScore > 50) {
      return 'Excellent';
    }

    if (this.npsScore >= 20) {
      return 'Bon';
    }

    if (this.npsScore >= 0) {
      return 'À améliorer';
    }

    return 'Critique';
  }

  get npsToneClass(): string {
    if (this.npsScore > 50) {
      return 'tone-success';
    }

    if (this.npsScore >= 20) {
      return 'tone-good';
    }

    if (this.npsScore >= 0) {
      return 'tone-warn';
    }

    return 'tone-danger';
  }

  get invitationStatusRows(): { label: string; percent: number; color: string }[] {
    const total = this.oldStudents.length;

    if (!total) {
      return [];
    }

    const map = [
      { label: 'Répondu', count: this.respondedCount, color: '#1D9E75' },
      { label: 'Invité', count: this.invitedCount, color: '#F5A623' },
      {
        label: 'Non contacté',
        count: this.oldStudents.filter(student => student.status === 'Non contacté').length,
        color: '#71717A'
      }
    ];

    return map.map(item => ({
      ...item,
      percent: Math.round((item.count / total) * 100)
    }));
  }

  get topCompanies(): { name: string; count: number }[] {
    const companyCounter = new Map<string, number>();

    this.dashboardStudents.forEach(student => {
      if (!student.company) {
        return;
      }

      const current = companyCounter.get(student.company) ?? 0;
      companyCounter.set(student.company, current + 1);
    });

    return [...companyCounter.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  get latestRespondents(): OldStudent[] {
    return [...this.dashboardStudents]
      .sort((a, b) => (b.feedbackDate ?? '').localeCompare(a.feedbackDate ?? ''))
      .slice(0, 5);
  }

  get filteredStudents(): OldStudent[] {
    let filtered = this.oldStudents.filter(s => {
      const matchTab = this.activeTab === 'anciens' || (this.activeTab === 'retours' && s.status === 'À répondu');
      const matchSearch = !this.searchTerm.trim() ||
        s.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.email.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        s.id.toLowerCase().includes(this.searchTerm.toLowerCase());

      return matchTab && matchSearch;
    });

    if (this.sortColumn) {
      filtered.sort((a, b) => {
        const valA = (a as any)[this.sortColumn];
        const valB = (b as any)[this.sortColumn];

        let comparison = 0;
        if (typeof valA === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number') {
          comparison = valA - valB;
        }

        return this.sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }

  setSort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  setActiveTab(tab: 'anciens' | 'retours') {
    this.activeTab = tab;
    this.sortColumn = '';
    this.searchTerm = '';
    this.scheduleDashboardCharts();
  }

  setPromoFilter(promo: number | null): void {
    this.selectedPromo = promo;
    this.scheduleDashboardCharts();
  }

  statusBadgeClass(status: OldStudent['status']): string {
    if (status === 'À répondu') {
      return 'badge-green';
    }

    if (status === 'Invité') {
      return 'badge-blue';
    }

    return 'badge-gray';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'À répondu':
        return 'status-responded';
      case 'Non contacté':
        return 'status-not-contacted';
      case 'Invité':
        return 'status-invited';
      default:
        return '';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'À répondu':
        return '✓';
      case 'Invité':
        return '✉';
      default:
        return '○';
    }
  }

  renderStars(rating: number): string {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }

  viewProfile(studentId: string): void {
    const student = this.oldStudents.find(s => s.id === studentId);
    if (student) {
      this.selectedStudent = student;
      this.showProfileModal = true;
    }
  }

  closeProfileModal(): void {
    this.showProfileModal = false;
    this.selectedStudent = null;
  }

  sendInvitation(studentId: string): void {
    const student = this.oldStudents.find(s => s.id === studentId);
    if (student && student.status === 'Non contacté') {
      student.status = 'Invité';
      alert(`Invitation envoyée à ${student.fullName}`);
      this.scheduleDashboardCharts();
    }
  }

  deleteStudent(studentId: string): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet ancien diplômé ?')) {
      this.oldStudents = this.oldStudents.filter(s => s.id !== studentId);
      this.scheduleDashboardCharts();
    }
  }

  trackById(index: number, item: OldStudent): string {
    return item.id;
  }

  openSendEmailModal(): void {
    this.showSendEmailModal = true;
  }

  openAddStudentModal(): void {
    this.newStudentForm = {
      fullName: '',
      email: '',
      promotion: '',
    };
    this.showAddStudentModal = true;
  }

  closeAddStudentModal(): void {
    this.showAddStudentModal = false;
  }

  async confirmAddStudent(): Promise<void> {
    const fullName = this.newStudentForm.fullName.trim();
    const email = this.newStudentForm.email.trim();
    const promotion = this.newStudentForm.promotion.trim();

    if (!fullName || !email || !promotion) {
      alert('Veuillez renseigner le nom, l’email et la promotion.');
      return;
    }

    try {
      const createdRow = await this.supabaseService.createAncienEtudiant({
        NOM: fullName,
        EMAIL: email,
        PROMOTION: promotion,
        'STATUT INVITATION': 'Non contacté',
        'RÉPONSE': 'Non répondu',
        ACTIONS: 'Relancer',
      });

      await this.supabaseService.createFeedback({
        nom_prenom: fullName,
        email,
        promotion,
        diplome: 'Licence',
        filiere: '',
        situation_actuelle: 'En recherche d\'emploi',
        secteur: '',
        poste_en_lien_formation: 'Pas du tout en lien',
        delai_premier_emploi: 'Encore en recherche',
        salaire_brut_mensuel: 'Ne souhaite pas',
        canal_efficace: 'LinkedIn',
        competences_techniques: '0',
        competences_gestion_projet: '0',
        competences_numeriques: '0',
        competences_communication: '0',
        maitrise_langues: '0',
        capacite_adaptation: '0',
        recommandation_isgis: '0',
        message_suggestion: '',
      });

      const mappedStudent = this.mapRowToOldStudent(createdRow);
      await this.refreshAllData();
      this.showAddStudentModal = false;
      this.successMessage = `${mappedStudent.fullName} a été ajouté au tableau.`;
      this.showSuccessNotification = true;

      setTimeout(() => {
        this.showSuccessNotification = false;
      }, 5000);
    } catch (err) {
      console.error('Failed to add ancien étudiant', err);
      alert('Impossible d’ajouter cet ancien diplômé.');
    }
  }

  closeSendEmailModal(): void {
    this.showSendEmailModal = false;
  }

  getUncontactedStudents(): OldStudent[] {
    return this.oldStudents.filter(s => s.status === 'Non contacté');
  }

  confirmSendEmail(): void {
    const uncontactedCount = this.getUncontactedStudents().length;
    
    if (uncontactedCount === 0) {
      alert('Aucun ancien diplômé à contacter');
      return;
    }

    if (confirm(`Êtes-vous sûr de vouloir envoyer ${uncontactedCount} email(s) ?\n\nObjet: ${this.emailSubject}`)) {
      // Simuler l'envoi des emails
      this.getUncontactedStudents().forEach(student => {
        student.status = 'Invité';
        console.log(`Email envoyé à ${student.fullName} (${student.email})`);
      });

      this.successMessage = `${uncontactedCount} email(s) envoyé(s) avec succès!`;
      this.showSuccessNotification = true;
      this.showSendEmailModal = false;

      // Masquer la notification après 5 secondes
      setTimeout(() => {
        this.showSuccessNotification = false;
      }, 5000);

      this.scheduleDashboardCharts();
    }
  }
}
