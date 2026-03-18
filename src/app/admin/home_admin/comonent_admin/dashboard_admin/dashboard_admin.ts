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
  activeScoreFilter: 'synergy' | 'cvAts' | 'employability' = 'synergy';

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
    { value: '74%', label: 'Taux Employabilite' },
    { value: '81%', label: 'Taux Synergie' },
    { value: '36', label: 'Nombre de Modules' },
  ];

  donutLegend = [
    { color: '#1e2d5a', label: 'Logistique' },
    { color: '#d97706', label: 'Transport' },
  ];

  domainPieLegend = [
    { color: '#e06456', label: 'SCM & Achat' },
    { color: '#2a9d8f', label: 'Transport Global' },
    { color: '#e9c46a', label: 'Logistique d\'Entrepôt' },
  ];

  radarAxes = ['Techniques', 'Organisation', 'Comportement', 'Physiques'];
  radarReq = [85, 80, 85, 75];
  radarAcq = [42, 55, 65, 70];
  radarChart: any;

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
    'Logistique': { bg: '#fef3e2', color: '#e07800' },
    'Transport': { bg: '#fef3e2', color: '#e07800' },
    'Supply Chain': { bg: '#e8f4fb', color: '#5baddb' },
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
  domainPieSegments: { color: string; dashArray: string; dashOffset: number }[];
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
  private readonly synergySeries = [6, 20, 70, 103, 46];

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

    // ── Domain Pie chart ─────────────────────────────────────────────
    const CPie = 2 * Math.PI * 50; // ≈ 314.16
    const rawPieSegs = [
      { color: '#e06456', pct: 0.45 },
      { color: '#2a9d8f', pct: 0.35 },
      { color: '#e9c46a', pct: 0.20 },
    ];
    let coveredPie = 0;
    this.domainPieSegments = rawPieSegs.map((s) => {
      const arcLength = +(s.pct * CPie).toFixed(2);
      const seg = {
        color: s.color,
        dashArray: `${arcLength} ${+CPie.toFixed(2)}`,
        dashOffset: +(-coveredPie).toFixed(2),
      };
      coveredPie += arcLength;
      return seg;
    });

    this.radarChart = this.buildRadarChart();
    this.barData = [];
    this.xGridLines = [];
    this.yGridLines = [];
    this.activeSeriesLegend = [];
    this.rebuildBarChart();
  }

  private buildRadarChart() {
    const cx = 150, cy = 150, r = 100;
    const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const anchors = ['middle', 'start', 'middle', 'end'];

    const axes = this.radarAxes.map((label, i) => {
      let lxd = 0; let lyd = 0;
      if (i === 0) { lyd = 15; }
      else if (i === 1) { lxd = 15; lyd = 2; }
      else if (i === 2) { lyd = 15; }
      else if (i === 3) { lxd = 15; lyd = 2; }

      const lx = cx + (r + lxd) * Math.cos(angles[i]);
      const ly = cy + (r + lyd) * Math.sin(angles[i]);
      return {
        label,
        x1: cx, y1: cy,
        x2: cx + r * Math.cos(angles[i]),
        y2: cy + r * Math.sin(angles[i]),
        lx: lx,
        ly: ly,
        anchor: anchors[i]
      };
    });

    const getPath = (data: number[]) => {
      const points = data.map((val, i) => {
        const d = (val / 100) * r;
        return `${cx + d * Math.cos(angles[i])},${cy + d * Math.sin(angles[i])}`;
      });
      return points.join(' ');
    };

    const gridPolys = [20, 40, 60, 80, 100].map(level => getPath([level, level, level, level]));

    return {
      axes,
      gridPolys,
      reqPath: getPath(this.radarReq),
      acqPath: getPath(this.radarAcq)
    };
  }

  setScoreFilter(filter: 'synergy' | 'cvAts' | 'employability') {
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
      synergy: {
        label: 'Score Synergie',
        color: '#c2410c',
        values: this.synergySeries,
      },
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
      this.activeScoreFilter === 'synergy'
        ? [allSeries.synergy]
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
