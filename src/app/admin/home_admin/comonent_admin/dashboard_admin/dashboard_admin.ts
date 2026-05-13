import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SupabaseService } from '../../../../services/supabase.service';
import { environment } from '../../../../../environments/environment';

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
  readonly barW = 76;
  activeScoreFilter: 'cvAts' | 'employability' = 'cvAts';

  selectedStudent: null = null;

  stats = [
    { value: '...', label: 'Étudiants inscrits' },
    { value: '...', label: "Taux d'employabilité" },
    { value: '...', label: "Nombre d’étudiants inscrits sur la plateforme" },
    { value: '...', label: 'Nombre de matière' },
  ];

  donutLegend: { color: string; label: string; pct: number }[] = [];

  domainPieLegend: { color: string; label: string; pct: number }[] = [];

  radarAxes = ['Techniques', 'Organisation', 'Comportement', 'Physiques'];
  radarReq = [85, 80, 85, 75];
  radarAcq = [42, 55, 65, 70];
  radarChart: any;

  recentStudents: Array<{
    name: string;
    id: string;
    speciality: string;
    score: number;
    employabilityScore: number;
    employabilityScoreRaw?: string;
    details: {
      matchings: string[];
      gaps: string[];
      recommendations: string[];
    };
  }> = [];

  recentStudentsLoading = false;
  recentStudentsError: string | null = null;
  topGapsLoading = false;
  topGapsError: string | null = null;


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
    return 'rgb(102, 102, 102)';
  }

  openStudentsPopup() {
    this.router.navigate(['/admin/etud']);
  }

  closeStudentsPopup() {
    this.showStudentsPopup = false;
  }

  donutSegments: { color: string; dashArray: string; dashOffset: number }[] = [];
  domainPieSegments: { color: string; dashArray: string; dashOffset: number }[];
  domainPieLabels: { x: number; y: number; text: string; color: string }[];
  marketColor: string;
  coverageColor: string;
  gapsData: { label: string; marketPct: number; coverPct: number }[];
  gapsChart: { label: string; y: number; labelX: number; barX: number; marketPct: number; coverPct: number; marketW: number; coverW: number }[];
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

  constructor(
    private router: Router,
    private supabaseService: SupabaseService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
  ) {
    this.domainPieSegments = [];
    this.domainPieLabels = [];

    // ── Top Gaps chart data — populated from backend ─────────────
    this.marketColor = '#1e2d5a';
    this.coverageColor = '#d97706';
    this.gapsData = [];
    this.gapsChart = [];

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
    this.fetchAndUpdateSocieteRegionsChart();
    this.fetchAndUpdateEmployabilityDistribution();
    this.fetchAndUpdateAtsDistribution();
    void this.fetchTopGaps();
    void this.fetchRecentStudents();
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

  async fetchAndUpdateSocieteRegionsChart() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('Societe')
      .select('*');

    if (error) {
      console.error('Error fetching Societe regions:', error);
      this.domainPieLegend = [];
      this.domainPieSegments = [];
      this.cdr.detectChanges();
      return;
    }

    const rows = (Array.isArray(data) ? data : []).filter((row: any) => this.isSocieteValidated(row));
    const counts = new Map<string, number>();

    rows.forEach((row: any) => {
      const region = this.extractSocieteRegion(row);
      counts.set(region, (counts.get(region) ?? 0) + 1);
    });

    const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const topEntries = sorted.slice(0, 5);
    const othersCount = sorted.slice(5).reduce((sum, [, count]) => sum + count, 0);
    if (othersCount > 0) {
      topEntries.push(['Autres', othersCount]);
    }

    const total = topEntries.reduce((sum, [, count]) => sum + count, 0);
    if (total <= 0) {
      this.domainPieLegend = [];
      this.domainPieSegments = [];
      this.cdr.detectChanges();
      return;
    }

    const palette = ['#e06456', '#2a9d8f', '#e9c46a', '#4f77ff', '#9b5de5', '#84a59d'];
    const segs = topEntries.map(([label, count], index) => ({
      color: palette[index % palette.length],
      label,
      pct: count / total,
    }));

    this.domainPieLegend = segs;

    const cPie = 2 * Math.PI * 50;
    let coveredPie = 0;
    this.domainPieSegments = segs.map((s) => {
      const arcLength = +(s.pct * cPie).toFixed(2);
      const seg = {
        color: s.color,
        dashArray: `${arcLength} ${+cPie.toFixed(2)}`,
        dashOffset: +(-coveredPie).toFixed(2),
      };
      coveredPie += arcLength;
      return seg;
    });

    this.cdr.detectChanges();
  }

  private extractSocieteRegion(row: any): string {
    const direct = [
      row?.region,
      row?.gouvernorat,
      row?.governorat,
      row?.ville,
      row?.city,
    ]
      .map((value) => String(value ?? '').trim())
      .find((value) => value.length > 0);

    if (direct) {
      return direct;
    }

    const adresse = String(row?.adresse ?? '').trim();
    if (adresse) {
      const parts = adresse
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 0) {
        return parts[parts.length - 1];
      }
    }

    return 'Non renseignée';
  }

  private isSocieteValidated(row: any): boolean {
    const boolCandidates = [
      row?.is_validated,
      row?.is_valide,
      row?.validated,
    ];

    if (boolCandidates.some((value) => value === true)) {
      return true;
    }

    const statusRaw = [
      row?.situation,
      row?.statut,
      row?.status,
      row?.validation_status,
      row?.etat_validation,
    ]
      .map((value) => String(value ?? '').trim())
      .find((value) => value.length > 0);

    if (!statusRaw) {
      return false;
    }

    const normalized = statusRaw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return normalized === 'validee' || normalized === 'valide' || normalized === 'approved' || normalized === 'active';
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

  async fetchTopGaps(): Promise<void> {
    this.topGapsLoading = true;
    this.topGapsError = null;
    try {
      const url = `${environment.apiUrl}/admin/dashboard/top-gaps`;
      const response = await firstValueFrom(
        this.http.get<{ data?: Array<{ label: string; marketPct: number; coverPct: number; count: number }> } | Array<{ label: string; marketPct: number; coverPct: number; count: number }>>(url),
      );
      const items = Array.isArray(response)
        ? response
        : (response as { data?: any[] })?.data ?? [];
      this.gapsData = (items ?? []).map((item: any) => ({
        label: String(item?.label ?? '').trim() || '—',
        marketPct: Number(item?.marketPct ?? 0),
        coverPct: Number(item?.coverPct ?? 0),
      }));
      this.rebuildGapsChart();
    } catch (err) {
      console.error('Failed to load top gaps:', err);
      this.topGapsError = 'Impossible de charger les gaps marché.';
      this.gapsData = [];
      this.gapsChart = [];
    } finally {
      this.topGapsLoading = false;
      this.cdr.detectChanges();
    }
  }

  async fetchRecentStudents(): Promise<void> {
    this.recentStudentsLoading = true;
    this.recentStudentsError = null;
    try {
      const url = `${environment.apiUrl}/admin/dashboard/students`;
      const response = await firstValueFrom(
        this.http.get<{ data?: any[] } | any[]>(url),
      );
      const rows = Array.isArray(response)
        ? response
        : (response as { data?: any[] })?.data ?? [];
      const mapped = (rows ?? []).map((row: any) => ({
        name: String(row?.name ?? '').trim() || 'Étudiant',
        id: String(row?.id ?? '').trim(),
        speciality: String(row?.speciality ?? '').trim() || 'Non renseignée',
        score: Number(row?.score ?? 0),
        employabilityScore: Number(row?.employabilityScore ?? 0),
        employabilityScoreRaw: row?.employabilityScoreRaw != null ? String(row.employabilityScoreRaw) : undefined,
        details: {
          matchings: Array.isArray(row?.details?.matchings) ? row.details.matchings : [],
          gaps: Array.isArray(row?.details?.gaps) ? row.details.gaps : [],
          recommendations: Array.isArray(row?.details?.recommendations) ? row.details.recommendations : [],
        },
      }));

      // Sort by employabilityScore descending and keep top 10
      mapped.sort((a, b) => (b.employabilityScore ?? 0) - (a.employabilityScore ?? 0));
      this.recentStudents = mapped.slice(0, 10);
    } catch (err) {
      console.error('Failed to load recent students:', err);
      this.recentStudentsError = 'Impossible de charger la liste des étudiants.';
      this.recentStudents = [];
    } finally {
      this.recentStudentsLoading = false;
      this.cdr.detectChanges();
    }
  }

  private rebuildGapsChart(): void {
    const maxBarW = 420;
    const barX = 200;
    const labelX = 190;
    this.gapsChart = (this.gapsData ?? []).map((d, i) => {
      const y = 30 + i * 36;
      return {
        label: d.label,
        y,
        labelX,
        barX,
        marketPct: d.marketPct,
        coverPct: d.coverPct,
        marketW: +((d.marketPct / 100) * maxBarW).toFixed(2),
        coverW: +((d.coverPct / 100) * maxBarW).toFixed(2),
      };
    });
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
        void this.fetchRecentStudents();
        void this.fetchTopGaps();
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
    const statIndex = this.stats.findIndex(s => s.label === "Nombre d’étudiants inscrits sur la plateforme");
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
