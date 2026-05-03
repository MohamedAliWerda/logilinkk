import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../../services/supabase.service';

@Component({
  selector: 'app-dashboard-admin',
  imports: [CommonModule],
  templateUrl: './dashboard_admin.html',
  styleUrl: './dashboard_admin.css',
})
export class DashboardAdmin implements OnInit, OnDestroy {
  adminName = 'Nour';
  sidebarCollapsed = false;
  activeMenu = 'dashboard';
  showStudentsPopup = false;
  showStudentProfilePopup = false;
  readonly barW = 76;
  activeScoreFilter: 'cvAts' | 'employability' = 'cvAts';

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
    { value: '...', label: 'Étudiants inscrits' },
    { value: '...', label: "Taux d'employabilité" },
    { value: '...', label: "Nombre d'étudiants avec profil scoré" },
    { value: '...', label: 'Nombre de matière' },
  ];

  donutLegend: { color: string; label: string; pct: number }[] = [];

  domainPieLegend: { color: string; label: string; pct: number }[] = [
    { color: '#e06456', label: 'SCM & Achat', pct: 0 },
    { color: '#2a9d8f', label: 'Transport Global', pct: 0 },
    { color: '#e9c46a', label: 'Logistique d\'Entrepôt', pct: 0 },
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
        gaps: ['Optimisation KPI transport', 'Gestion avancée WMS'],
        recommendations: ['Atelier KPI Logistique', "Projet terrain d'entrepôt"],
      },
    },
    {
      name: 'Fatma Trabelsi', id: 'ISGI2025-043', speciality: 'Transport', score: 78, employabilityScore: 75,
      details: {
        matchings: ['Agent Exploitation Transport', 'Planificatrice Tournées'],
        gaps: ['Modélisation des coûts', 'Suivi SLA client'],
        recommendations: ['Formation TMS avancée', 'Simulation SLA'],
      },
    },
    {
      name: 'Mohamed Karray', id: 'ISGI2025-044', speciality: 'Supply Chain', score: 91, employabilityScore: 87,
      details: {
        matchings: ['Assistant Demand Planner', 'Junior Supply Analyst'],
        gaps: ['Data visualisation', 'Négociation fournisseurs'],
        recommendations: ['Certif BI fundamentals', 'Cas pratique sourcing'],
      },
    },
    {
      name: 'Sarra Gharbi', id: 'ISGI2025-045', speciality: 'Logistique', score: 67, employabilityScore: 69,
      details: {
        matchings: ['Assistante Stock', 'Opératrice Flux'],
        gaps: ['Tableaux de bord', 'Gestion des retours'],
        recommendations: ['Bootcamp Excel opérationnel', 'Module Reverse Logistics'],
      },
    },
    {
      name: 'Youssef Hammami', id: 'ISGI2025-046', speciality: 'Commerce Int.', score: 74, employabilityScore: 72,
      details: {
        matchings: ['Assistant Import/Export', 'Coordinateur Transit Junior'],
        gaps: ['Documentation douanière', 'Incoterms avancés'],
        recommendations: ['Atelier Douane', 'Préparation certif. Incoterms'],
      },
    },
  ];

  allStudents = [
    {
      name: 'Ahmed Ben Ali', id: 'ISGI2025-042', speciality: 'Logistique', score: 85, employabilityScore: 81,
      details: {
        matchings: ['Coordinateur Supply Chain', 'Analyste Flux Logistiques'],
        gaps: ['Optimisation KPI transport', 'Gestion avancée WMS'],
        recommendations: ['Atelier KPI Logistique', "Projet terrain d'entrepôt"],
      },
    },
    {
      name: 'Fatma Trabelsi', id: 'ISGI2025-043', speciality: 'Transport', score: 78, employabilityScore: 75,
      details: {
        matchings: ['Agent Exploitation Transport', 'Planificatrice Tournées'],
        gaps: ['Modélisation des coûts', 'Suivi SLA client'],
        recommendations: ['Formation TMS avancée', 'Simulation SLA'],
      },
    },
    {
      name: 'Mohamed Karray', id: 'ISGI2025-044', speciality: 'Supply Chain', score: 91, employabilityScore: 87,
      details: {
        matchings: ['Assistant Demand Planner', 'Junior Supply Analyst'],
        gaps: ['Data visualisation', 'Négociation fournisseurs'],
        recommendations: ['Certif BI fundamentals', 'Cas pratique sourcing'],
      },
    },
    {
      name: 'Sarra Gharbi', id: 'ISGI2025-045', speciality: 'Logistique', score: 67, employabilityScore: 69,
      details: {
        matchings: ['Assistante Stock', 'Opératrice Flux'],
        gaps: ['Tableaux de bord', 'Gestion des retours'],
        recommendations: ['Bootcamp Excel opérationnel', 'Module Reverse Logistics'],
      },
    },
    {
      name: 'Youssef Hammami', id: 'ISGI2025-046', speciality: 'Commerce Int.', score: 74, employabilityScore: 72,
      details: {
        matchings: ['Assistant Import/Export', 'Coordinateur Transit Junior'],
        gaps: ['Documentation douanière', 'Incoterms avancés'],
        recommendations: ['Atelier Douane', 'Préparation certif. Incoterms'],
      },
    },
    {
      name: 'Nour Ben Hassen', id: 'ISGI2025-047', speciality: 'Transport', score: 83, employabilityScore: 80,
      details: {
        matchings: ['Planificatrice Transport', 'Assistante Affrètement'],
        gaps: ['Pilotage KPI ponctualité', 'Gestion incidents route'],
        recommendations: ['Module dispatching avancé', 'Cas incidents multi-sites'],
      },
    },
    {
      name: 'Imen Chahed', id: 'ISGI2025-048', speciality: 'Supply Chain', score: 88, employabilityScore: 86,
      details: {
        matchings: ['Supply Planner Junior', 'Analyste Approvisionnement'],
        gaps: ['Forecasting avancé', 'Contract management'],
        recommendations: ['Mini-projet S&OP', 'Atelier procurement'],
      },
    },
    {
      name: 'Walid Jebali', id: 'ISGI2025-049', speciality: 'Logistique', score: 79, employabilityScore: 77,
      details: {
        matchings: ['Superviseur Quai Junior', 'Coordinateur Stock'],
        gaps: ['Lean logistics', 'Analyse ABC/XYZ'],
        recommendations: ['Formation Lean entrepôt', 'Workshop analyses stocks'],
      },
    },
    {
      name: 'Rim Khelifi', id: 'ISGI2025-050', speciality: 'Commerce Int.', score: 81, employabilityScore: 79,
      details: {
        matchings: ['Assistante Trade Compliance', 'Chargée Export'],
        gaps: ['Veille réglementaire', 'Négociation internationale'],
        recommendations: ['Atelier compliance', 'Simulation négociations'],
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

  donutSegments: { color: string; dashArray: string; dashOffset: number }[] = [];
  domainPieSegments: { color: string; dashArray: string; dashOffset: number }[];
  domainPieLabels: { x: number; y: number; text: string; color: string }[];
  marketColor: string;
  coverageColor: string;
  gapsData: { label: string; marketPct: number; coverPct: number }[];
  gapsChart: { label: string; y: number; marketPct: number; coverPct: number; marketW: number; coverW: number }[];
  barData: {
    range: string;
    labelX: number;
    bars: { x: number; y: number; width: number; height: number; color: string }[];
  }[];
  xGridLines: number[];
  yGridLines: { value: number; y: number }[];
  activeSeriesLegend: { label: string; color: string }[];

  private readonly atsRanges = ['0-20', '20-40', '40-60', '60-80', '80-100'];
  private readonly employabilityRanges = ['50-60', '60-70', '70-80', '80-90', '90-100'];
  private cvAtsSeries = [0, 0, 0, 0, 0];
  private employabilitySeries = [0, 0, 0, 0, 0];

  private employabilitySubscription: any;
  private studentsSubscription: any;
  private matiereSubscription: any;
  private cvSubscription: any;

  constructor(private router: Router, private supabaseService: SupabaseService, private cdr: ChangeDetectorRef) {
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

    // attach pct to legend entries
    this.domainPieLegend = this.domainPieLegend.map((d, i) => ({ ...d, pct: rawPieSegs[i]?.pct ?? 0 }));

    // compute label positions for domain pie
    this.domainPieLabels = [];
    let cumPct = 0;
    const labelR = 70;
    for (const s of rawPieSegs) {
      const mid = cumPct + s.pct / 2;
      const angle = mid * Math.PI * 2 - Math.PI / 2; // account for rotate(-90)
      const x = +(100 + Math.cos(angle) * labelR).toFixed(2);
      const y = +(100 + Math.sin(angle) * labelR).toFixed(2);
      const text = `${Math.round(s.pct * 100)}%`;
      const color = this.getContrastColor(s.color);
      this.domainPieLabels.push({ x, y, text, color });
      cumPct += s.pct;
    }

    // ── Top Gaps chart data (replaces radar visual) ─────────────────
    this.marketColor = '#1e2d5a';
    this.coverageColor = '#d97706';
    this.gapsData = [
      { label: 'SAP/ERP', marketPct: 92, coverPct: 18 },
      { label: 'WMS', marketPct: 78, coverPct: 12 },
      { label: 'Power BI', marketPct: 68, coverPct: 22 },
      { label: 'RFID/IoT', marketPct: 58, coverPct: 10 },
      { label: 'TMS', marketPct: 55, coverPct: 20 },
      { label: 'Lean Mgmt', marketPct: 42, coverPct: 28 },
    ];
    const maxBarW = 360;
    this.gapsChart = this.gapsData.map((d, i) => {
      const y = 30 + i * 36;
      return {
        label: d.label,
        y,
        marketPct: d.marketPct,
        coverPct: d.coverPct,
        marketW: +((d.marketPct / 100) * maxBarW).toFixed(2),
        coverW: +((d.coverPct / 100) * maxBarW).toFixed(2),
      };
    });

    this.radarChart = this.buildRadarChart();
    this.barData = [];
    this.xGridLines = [];
    this.yGridLines = [];
    this.activeSeriesLegend = [];
    this.rebuildBarChart();
  }

  ngOnInit() {
    this.fetchAndUpdateEmployabilityAverage();
    this.fetchAndUpdateStudentsCount();
    this.fetchAndUpdateMatiereCount();
    this.fetchAndUpdateScoredProfilesCount();
    this.fetchAndUpdateFiliereChart();
    this.fetchAndUpdateEmployabilityDistribution();
    this.fetchAndUpdateAtsDistribution();
    this.setupRealtimeSubscription();
  }

  ngOnDestroy() {
    if (this.employabilitySubscription) {
      this.employabilitySubscription.unsubscribe();
    }
    if (this.studentsSubscription) {
      this.studentsSubscription.unsubscribe();
    }
    if (this.matiereSubscription) {
      this.matiereSubscription.unsubscribe();
    }
    if (this.cvSubscription) {
      this.cvSubscription.unsubscribe();
    }
  }

  async fetchAndUpdateEmployabilityAverage() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('score_final');

    if (error) {
      console.error('Error fetching score_employabilité:', error);
      this.updateEmployabilityStat('Erreur');
      return;
    }

    if (data && data.length > 0) {
      const sum = data.reduce((acc, row) => acc + (row.score_final || 0), 0);
      const average = sum / data.length;
      const formattedAvg = average.toFixed(2);

      this.updateEmployabilityStat(`${formattedAvg}%`);
    } else {
      this.updateEmployabilityStat('0.00%');
    }
  }

  async fetchAndUpdateStudentsCount() {
    const supabase = this.supabaseService.adminClient;
    const { count, error } = await supabase
      .from('profils_etudiant')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching profils_etudiant count:', error);
      this.updateStudentsStat('Erreur');
      return;
    }

    this.updateStudentsStat((count || 0).toString());
  }

  async fetchAndUpdateMatiereCount() {
    const supabase = this.supabaseService.adminClient;
    const { count, error } = await supabase
      .from('matiere')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching matiere count:', error);
      this.updateMatiereStat('Erreur');
      return;
    }

    this.updateMatiereStat((count || 0).toString());
  }

  async fetchAndUpdateScoredProfilesCount() {
    const supabase = this.supabaseService.adminClient;
    const { count, error } = await supabase
      .from('score_employabilité')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error fetching score_employabilité count:', error);
      this.updateScoredStat('Erreur');
      return;
    }

    this.updateScoredStat((count || 0).toString());
  }

  async fetchAndUpdateFiliereChart() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('parcours_type, filiere_licence, filiere_master');

    if (error) {
      console.error('Error fetching filiere distribution:', error);
      return;
    }

    let total = data.length;
    if (total === 0) return;

    let l_t = 0;
    let l_l = 0;
    let m_s = 0;
    let m_i = 0;

    for (const row of data) {
      const type = row.parcours_type;
      let filiere = '';
      if (type === 'L') {
        filiere = row.filiere_licence || '';
      } else if (type === 'M' || type === 'LM') {
        filiere = row.filiere_master || '';
      }

      if (filiere === 'Licence_Sciences_de_Transport') l_t++;
      else if (filiere === 'Licence_Génie_Logistique') l_l++;
      else if (filiere === 'Master_Recherche_STL') m_s++;
      else if (filiere === 'Master_Pro_Génie_Industriel_et_Logistique') m_i++;
    }

    const rawSegs = [
      { color: '#1e2d5a', label: 'Licence Sciences de Transport', pct: l_t / total },
      { color: '#d97706', label: 'Licence Génie Logistique', pct: l_l / total },
      { color: '#2a9d8f', label: 'Master Recherche STL', pct: m_s / total },
      { color: '#e06456', label: 'Master Pro GTI & Logistique', pct: m_i / total },
    ];

    this.donutLegend = rawSegs.map(s => ({ color: s.color, label: s.label, pct: s.pct }));

    const C = 2 * Math.PI * 70;
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

    this.cdr.detectChanges();
  }

  async fetchAndUpdateEmployabilityDistribution() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('score_final');

    if (error) {
      console.error('Error fetching score_employabilité for distribution:', error);
      return;
    }
    if (data && data.length > 0) {
      this.employabilitySeries = this.calculateEmployabilityDistribution(data);
      this.rebuildBarChart();
      this.cdr.detectChanges();
    }
  }

  async fetchAndUpdateAtsDistribution() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('cv_submissions')
      .select('ats_score');

    if (error) {
      console.error('Error fetching cv_submissions for distribution:', error);
      return;
    }
    if (data && data.length > 0) {
      this.cvAtsSeries = this.calculateAtsDistribution(data);
      this.rebuildBarChart();
      this.cdr.detectChanges();
    }
  }

  private calculateAtsDistribution(data: any[]): number[] {
    const dist = [0, 0, 0, 0, 0];
    if (!data) return dist;
    for (const row of data) {
      const score = row.ats_score || 0;
      if (score >= 0 && score < 20) dist[0]++;
      else if (score >= 20 && score < 40) dist[1]++;
      else if (score >= 40 && score < 60) dist[2]++;
      else if (score >= 60 && score < 80) dist[3]++;
      else if (score >= 80 && score <= 100) dist[4]++;
    }
    return dist;
  }

  private calculateEmployabilityDistribution(data: any[]): number[] {
    const dist = [0, 0, 0, 0, 0];
    if (!data) return dist;
    for (const row of data) {
      const score = row.score_final || 0;
      if (score >= 50 && score < 60) dist[0]++;
      else if (score >= 60 && score < 70) dist[1]++;
      else if (score >= 70 && score < 80) dist[2]++;
      else if (score >= 80 && score < 90) dist[3]++;
      else if (score >= 90 && score <= 100) dist[4]++;
    }
    return dist;
  }

  setupRealtimeSubscription() {
    const supabase = this.supabaseService.adminClient;
    this.employabilitySubscription = supabase
      .channel('public:score_employabilité')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_employabilité' }, payload => {
        this.fetchAndUpdateEmployabilityAverage();
        this.fetchAndUpdateScoredProfilesCount();
        this.fetchAndUpdateFiliereChart();
        this.fetchAndUpdateEmployabilityDistribution();
      })
      .subscribe();

    this.studentsSubscription = supabase
      .channel('public:profils_etudiant')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profils_etudiant' }, payload => {
        this.fetchAndUpdateStudentsCount();
      })
      .subscribe();

    this.matiereSubscription = supabase
      .channel('public:matiere')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matiere' }, payload => {
        this.fetchAndUpdateMatiereCount();
      })
      .subscribe();

    this.cvSubscription = supabase
      .channel('public:cv_submissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cv_submissions' }, payload => {
        this.fetchAndUpdateAtsDistribution();
      })
      .subscribe();
  }

  updateEmployabilityStat(newValue: string) {
    const statIndex = this.stats.findIndex(s => s.label === "Taux d'employabilité");
    if (statIndex !== -1) {
      const updatedStats = [...this.stats];
      updatedStats[statIndex] = { ...updatedStats[statIndex], value: newValue };
      this.stats = updatedStats;
      this.cdr.detectChanges();
    }
  }

  updateStudentsStat(newValue: string) {
    const statIndex = this.stats.findIndex(s => s.label === 'Étudiants inscrits');
    if (statIndex !== -1) {
      const updatedStats = [...this.stats];
      updatedStats[statIndex] = { ...updatedStats[statIndex], value: newValue };
      this.stats = updatedStats;
      this.cdr.detectChanges();
    }
  }

  updateMatiereStat(newValue: string) {
    const statIndex = this.stats.findIndex(s => s.label === 'Nombre de matière');
    if (statIndex !== -1) {
      const updatedStats = [...this.stats];
      updatedStats[statIndex] = { ...updatedStats[statIndex], value: newValue };
      this.stats = updatedStats;
      this.cdr.detectChanges();
    }
  }

  updateScoredStat(newValue: string) {
    const statIndex = this.stats.findIndex(s => s.label === "Nombre d'étudiants avec profil scoré");
    if (statIndex !== -1) {
      const updatedStats = [...this.stats];
      updatedStats[statIndex] = { ...updatedStats[statIndex], value: newValue };
      this.stats = updatedStats;
      this.cdr.detectChanges();
    }
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

  setScoreFilter(filter: 'cvAts' | 'employability') {
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
    const BAR_MAX = Math.max(
      10,
      ...this.employabilitySeries,
      ...this.cvAtsSeries
    ) * 1.2; // dynamically scale Y-axis based on max item
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
        label: 'Score Employabilité',
        color: '#1e2d5a',
        values: this.employabilitySeries,
      },
    } as const;

    const activeSeries =
      this.activeScoreFilter === 'cvAts'
        ? [allSeries.cvAts]
        : [allSeries.employability];

    this.activeSeriesLegend = activeSeries.map((s) => ({
      label: s.label,
      color: s.color,
    }));

    const currentRanges =
      this.activeScoreFilter === 'cvAts'
        ? this.atsRanges
        : this.employabilityRanges;

    this.barData = currentRanges.map((range, i) => {
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

    const maxVal = BAR_MAX;
    const step = maxVal / 4;
    const gridVals = [maxVal, step * 3, step * 2, step, 0].map(v => Math.round(v));
    this.yGridLines = gridVals.map((v) => ({
      value: v,
      y: +(Y_BOTTOM - (v / BAR_MAX) * CHART_H).toFixed(2),
    }));
  }

  private getContrastColor(hex: string): string {
    if (!hex) return '#ffffff';
    const c = hex.replace('#', '');
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 150 ? '#1a1a2e' : '#ffffff';
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
