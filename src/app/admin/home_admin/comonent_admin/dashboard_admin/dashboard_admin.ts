import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard-admin',
  imports: [CommonModule],
  templateUrl: './dashboard_admin.html',
  styleUrl: './dashboard_admin.css',
})
export class DashboardAdmin {
  adminName = 'Nour';
  sidebarCollapsed = false;
  activeMenu = 'dashboard';
  showStudentsPopup = false;
  showStudentProfilePopup = false;
  readonly barW = 76;
  activeScoreFilter: 'both' | 'cvAts' | 'employability' = 'both';

  selectedStudent: {
    name: string;
    id: string;
    speciality: string;
    score: number;
    employabilityScore: number;
    details: {
      matchings: string[];
      gaps: string[];
      recommendations: string[];
    };
  } | null = null;

  stats = [
    { value: '247', label: 'Étudiants inscrits' },
    { value: '78%', label: 'Taux CV ATS' },
    { value: '74%', label: 'Taux Employabilite' },
    { value: '36', label: 'Nombre de Modules' },
  ];

  donutLegend = [
    { color: '#1e2d5a', label: 'Logistique' },
    { color: '#d97706', label: 'Transport' },
  ];

  gapCharts = [
    {
      title: 'Gap vs. Profile',
      color: '#d97706',
      points: [
        { label: 'L1', value: 62 },
        { label: 'L2', value: 54 },
        { label: 'T1', value: 47 },
        { label: 'SC', value: 58 },
      ],
    },
    {
      title: 'Gap vs. Skills',
      color: '#2f8f83',
      points: [
        { label: 'Tech', value: 43 },
        { label: 'Soft', value: 35 },
        { label: 'Data', value: 51 },
        { label: 'Ops', value: 39 },
      ],
    },
    {
      title: 'Gap vs. Market Requirements',
      color: '#1e2d5a',
      points: [
        { label: 'M1', value: 66 },
        { label: 'M2', value: 59 },
        { label: 'M3', value: 63 },
        { label: 'M4', value: 57 },
      ],
    },
    {
      title: 'Gap vs. Modules',
      color: '#8b5cf6',
      points: [
        { label: 'Mod1', value: 38 },
        { label: 'Mod2', value: 42 },
        { label: 'Mod3', value: 33 },
        { label: 'Mod4', value: 46 },
      ],
    },
  ];

  recentStudents = [
    {
      name: 'Ahmed Ben Ali', id: 'ISGI2025-042', speciality: 'Logistique', score: 85, employabilityScore: 81,
      details: {
        matchings: ['Coordinateur Supply Chain', 'Analyste Flux Logistiques'],
        gaps: ['Optimisation KPI transport', 'Gestion avancee WMS'],
        recommendations: ['Atelier KPI Logistique', 'Projet terrain entrepot'],
      },
    },
    {
      name: 'Fatma Trabelsi', id: 'ISGI2025-043', speciality: 'Transport', score: 78, employabilityScore: 75,
      details: {
        matchings: ['Agent Exploitation Transport', 'Planificatrice Tournees'],
        gaps: ['Modelisation des couts', 'Suivi SLA client'],
        recommendations: ['Formation TMS avancee', 'Simulation SLA'],
      },
    },
    {
      name: 'Mohamed Karray', id: 'ISGI2025-044', speciality: 'Supply Chain', score: 91, employabilityScore: 87,
      details: {
        matchings: ['Assistant Demand Planner', 'Junior Supply Analyst'],
        gaps: ['Data visualisation', 'Negotiation fournisseurs'],
        recommendations: ['Certif BI fundamentals', 'Cas pratique sourcing'],
      },
    },
    {
      name: 'Sarra Gharbi', id: 'ISGI2025-045', speciality: 'Logistique', score: 67, employabilityScore: 69,
      details: {
        matchings: ['Assistante Stock', 'Operatrice Flux'],
        gaps: ['Tableaux de bord', 'Gestion des retours'],
        recommendations: ['Bootcamp Excel operationnel', 'Module Reverse Logistics'],
      },
    },
    {
      name: 'Youssef Hammami', id: 'ISGI2025-046', speciality: 'Commerce Int.', score: 74, employabilityScore: 72,
      details: {
        matchings: ['Assistant Import/Export', 'Coordinateur Transit Junior'],
        gaps: ['Documentation douaniere', 'Incoterms avances'],
        recommendations: ['Atelier Douane', 'Preparation certif Incoterms'],
      },
    },
  ];

  allStudents = [
    {
      name: 'Ahmed Ben Ali', id: 'ISGI2025-042', speciality: 'Logistique', score: 85, employabilityScore: 81,
      details: {
        matchings: ['Coordinateur Supply Chain', 'Analyste Flux Logistiques'],
        gaps: ['Optimisation KPI transport', 'Gestion avancee WMS'],
        recommendations: ['Atelier KPI Logistique', 'Projet terrain entrepot'],
      },
    },
    {
      name: 'Fatma Trabelsi', id: 'ISGI2025-043', speciality: 'Transport', score: 78, employabilityScore: 75,
      details: {
        matchings: ['Agent Exploitation Transport', 'Planificatrice Tournees'],
        gaps: ['Modelisation des couts', 'Suivi SLA client'],
        recommendations: ['Formation TMS avancee', 'Simulation SLA'],
      },
    },
    {
      name: 'Mohamed Karray', id: 'ISGI2025-044', speciality: 'Supply Chain', score: 91, employabilityScore: 87,
      details: {
        matchings: ['Assistant Demand Planner', 'Junior Supply Analyst'],
        gaps: ['Data visualisation', 'Negotiation fournisseurs'],
        recommendations: ['Certif BI fundamentals', 'Cas pratique sourcing'],
      },
    },
    {
      name: 'Sarra Gharbi', id: 'ISGI2025-045', speciality: 'Logistique', score: 67, employabilityScore: 69,
      details: {
        matchings: ['Assistante Stock', 'Operatrice Flux'],
        gaps: ['Tableaux de bord', 'Gestion des retours'],
        recommendations: ['Bootcamp Excel operationnel', 'Module Reverse Logistics'],
      },
    },
    {
      name: 'Youssef Hammami', id: 'ISGI2025-046', speciality: 'Commerce Int.', score: 74, employabilityScore: 72,
      details: {
        matchings: ['Assistant Import/Export', 'Coordinateur Transit Junior'],
        gaps: ['Documentation douaniere', 'Incoterms avances'],
        recommendations: ['Atelier Douane', 'Preparation certif Incoterms'],
      },
    },
    {
      name: 'Nour Ben Hassen', id: 'ISGI2025-047', speciality: 'Transport', score: 83, employabilityScore: 80,
      details: {
        matchings: ['Planificatrice Transport', 'Assistante Affretement'],
        gaps: ['Pilotage KPI ponctualite', 'Gestion incidents route'],
        recommendations: ['Module dispatching avance', 'Cas incidents multi-sites'],
      },
    },
    {
      name: 'Imen Chahed', id: 'ISGI2025-048', speciality: 'Supply Chain', score: 88, employabilityScore: 86,
      details: {
        matchings: ['Supply Planner Junior', 'Analyste Approvisionnement'],
        gaps: ['Forecasting avance', 'Contract management'],
        recommendations: ['Mini-projet S&OP', 'Atelier procurement'],
      },
    },
    {
      name: 'Walid Jebali', id: 'ISGI2025-049', speciality: 'Logistique', score: 79, employabilityScore: 77,
      details: {
        matchings: ['Superviseur Quai Junior', 'Coordinateur Stock'],
        gaps: ['Lean logistics', 'Analyse ABC/XYZ'],
        recommendations: ['Formation Lean entrepot', 'Workshop analyses stocks'],
      },
    },
    {
      name: 'Rim Khelifi', id: 'ISGI2025-050', speciality: 'Commerce Int.', score: 81, employabilityScore: 79,
      details: {
        matchings: ['Assistante Trade Compliance', 'Chargee Export'],
        gaps: ['Veille reglementaire', 'Negociation internationale'],
        recommendations: ['Atelier compliance', 'Simulation negociations'],
      },
    },
    {
      name: 'Marouen Triki', id: 'ISGI2025-051', speciality: 'Transport', score: 72, employabilityScore: 70,
      details: {
        matchings: ['Agent Transit', 'Assistant Exploitation'],
        gaps: ['Suivi performance flotte', 'Plan de charge'],
        recommendations: ['Module fleet analytics', 'Coaching planification'],
      },
    },
  ];

  specialityColors: Record<string, { bg: string; color: string }> = {
    'Logistique':    { bg: '#fef3e2', color: '#e07800' },
    'Transport':     { bg: '#fef3e2', color: '#e07800' },
    'Supply Chain':  { bg: '#e8f4fb', color: '#5baddb' },
    'Commerce Int.': { bg: '#e8f7ef', color: '#5dbf7a' },
  };

  getBadgeStyle(speciality: string) {
    return this.specialityColors[speciality] ?? { bg: '#f0f0f0', color: '#666' };
  }

  scoreColor(score: number): string {
    return score >= 85 ? '#5dbf7a' : '#e07800';
  }

  openStudentsPopup() {
    this.router.navigate(['/admin/etud']);
  }

  closeStudentsPopup() {
    this.showStudentsPopup = false;
  }

  openStudentProfile(student: {
    name: string;
    id: string;
    speciality: string;
    score: number;
    employabilityScore: number;
    details: {
      matchings: string[];
      gaps: string[];
      recommendations: string[];
    };
  }) {
    this.selectedStudent = student;
    this.showStudentProfilePopup = true;
  }

  closeStudentProfile() {
    this.showStudentProfilePopup = false;
    this.selectedStudent = null;
  }

  donutSegments: { color: string; dashArray: string; dashOffset: number }[];
  barData: {
    range: string;
    labelX: number;
    bars: { x: number; y: number; width: number; height: number; color: string }[];
  }[];
  xGridLines: number[];
  yGridLines: { value: number; y: number }[];
  activeSeriesLegend: { label: string; color: string }[];

  private readonly scoreRanges = ['0-20', '20-40', '40-60', '60-80', '80-100'];
  private readonly cvAtsSeries = [5, 18, 72, 108, 43];
  private readonly employabilitySeries = [7, 21, 69, 98, 49];

  constructor(private router: Router) {
    // ── Donut chart ─────────────────────────────────────────────
    const C = 2 * Math.PI * 70; // ≈ 439.82
    const rawSegs = [
      { color: '#1e2d5a', pct: 0.5 },
      { color: '#d97706', pct: 0.5 },
    ];
    let covered = 0;
    this.donutSegments = rawSegs.map((s) => {
      const arcLength = +(s.pct * C).toFixed(2);
      const seg = {
        color: s.color,
        dashArray: `${arcLength} ${+C.toFixed(2)}`,
        dashOffset: +(-covered).toFixed(2),
      };
      covered += arcLength;
      return seg;
    });

    this.barData = [];
    this.xGridLines = [];
    this.yGridLines = [];
    this.activeSeriesLegend = [];
    this.rebuildBarChart();
  }

  setScoreFilter(filter: 'both' | 'cvAts' | 'employability') {
    this.activeScoreFilter = filter;
    this.rebuildBarChart();
  }

  averageGap(values: { value: number }[]): number {
    if (values.length === 0) {
      return 0;
    }
    const total = values.reduce((sum, item) => sum + item.value, 0);
    return Math.round(total / values.length);
  }

  private rebuildBarChart() {
    const BAR_MAX = 120;
    const CHART_H = 245;
    const Y_BOTTOM = 265;
    const X_START = 60;
    const SLOT_W = 96;

    const allSeries = {
      cvAts: {
        label: 'Score CV ATS',
        color: '#2f8f83',
        values: this.cvAtsSeries,
      },
      employability: {
        label: 'Score Employabilite',
        color: '#1e2d5a',
        values: this.employabilitySeries,
      },
    } as const;

    const activeSeries =
      this.activeScoreFilter === 'both'
        ? [allSeries.cvAts, allSeries.employability]
        : this.activeScoreFilter === 'cvAts'
          ? [allSeries.cvAts]
          : [allSeries.employability];

    this.activeSeriesLegend = activeSeries.map((s) => ({
      label: s.label,
      color: s.color,
    }));

    this.barData = this.scoreRanges.map((range, i) => {
      const barCount = activeSeries.length;
      const groupWidth = 74;
      const intraGap = barCount > 1 ? 8 : 0;
      const barWidth = (groupWidth - intraGap * (barCount - 1)) / barCount;
      const startX = X_START + i * SLOT_W + (SLOT_W - groupWidth) / 2;

      const bars = activeSeries.map((series, j) => {
        const value = series.values[i];
        const h = Math.max(+(value / BAR_MAX * CHART_H).toFixed(2), 3);
        return {
          x: +(startX + j * (barWidth + intraGap)).toFixed(2),
          y: +(Y_BOTTOM - h).toFixed(2),
          width: +barWidth.toFixed(2),
          height: h,
          color: series.color,
        };
      });

      return {
        range,
        labelX: +(X_START + i * SLOT_W + SLOT_W / 2).toFixed(2),
        bars,
      };
    });

    this.xGridLines = this.barData.map((d) => d.labelX);

    this.yGridLines = [120, 90, 60, 30, 0].map((v) => ({
      value: v,
      y: +(Y_BOTTOM - (v / BAR_MAX) * CHART_H).toFixed(2),
    }));
  }

  logout() {
    this.router.navigate(['/']);
  }

  setMenu(menu: string) {
    this.activeMenu = menu;
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
