import { ChangeDetectionStrategy, Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../../../services/supabase.service';

type FiliereStat = {
  filiere: string;
  score: number;
};

type NiveauStat = {
  niveau: string;
  score: number;
};

type DistributionBin = {
  range: string;
  students: number;
  percentage?: number;
};

@Component({
  selector: 'app-score-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './score_admin.html',
  styleUrl: './score_admin.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScoreAdmin implements OnInit, OnDestroy {

  /* ── 1. Score général ─────────────────────────────────── */
  scoreGeneral: number = 0;
  scoreGeneralDisplay: string = '...';
  scoreGradient = 'conic-gradient(#f4a23b 0% 0%, #eceff4 0% 100%)';
  scoreLabel = 'Chargement...';
  barWidth = 0;

  stats = [
    { value: '...', label: "Nombre d’étudiants inscrits sur la plateforme" },
    { value: '...', label: "Meilleurs profils (≥ 75%)" },
  ];

  private employabilitySubscription: any;

  constructor(private supabaseService: SupabaseService, private cdr: ChangeDetectorRef) { }

  ngOnInit() {
    this.fetchAndUpdateEmployabilityAverage();
    this.fetchAndUpdateScoreDistribution();
    this.fetchAndUpdateFiliereScore();
    this.fetchAndUpdateParcoursScore();
    this.fetchCount('score_employabilité', "Nombre d’étudiants inscrits sur la plateforme");
    this.fetchCount('score_employabilité', "Meilleurs profils (≥ 75%)", { gte: ['score_final', 75] });
    this.setupRealtimeSubscription();
  }

  ngOnDestroy() {
    if (this.employabilitySubscription) {
      this.employabilitySubscription.unsubscribe();
    }
  }

  async fetchAndUpdateEmployabilityAverage() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('score_final');

    if (error) {
      console.error('Error fetching score_employabilité:', error);
      this.scoreLabel = 'Erreur';
      this.cdr.detectChanges();
      return;
    }

    if (data && data.length > 0) {
      const sum = data.reduce((acc, row) => acc + (row.score_final || 0), 0);
      const average = sum / data.length;

      this.scoreGeneral = Number(average.toFixed(2));
      this.scoreGeneralDisplay = average.toFixed(2);

      if (this.scoreGeneral >= 75) {
        this.scoreLabel = 'Excellent';
        this.scoreGradient = `conic-gradient(#5dbf7a 0% ${this.scoreGeneral}%, #eceff4 ${this.scoreGeneral}% 100%)`;
      } else if (this.scoreGeneral >= 55) {
        this.scoreLabel = 'Bon';
        this.scoreGradient = `conic-gradient(#f4a23b 0% ${this.scoreGeneral}%, #eceff4 ${this.scoreGeneral}% 100%)`;
      } else {
        this.scoreLabel = 'Moyen';
        this.scoreGradient = `conic-gradient(#e06456 0% ${this.scoreGeneral}%, #eceff4 ${this.scoreGeneral}% 100%)`;
      }
    } else {
      this.scoreGeneral = 0;
      this.scoreGeneralDisplay = '0.00';
      this.scoreLabel = 'N/A';
      this.scoreGradient = 'conic-gradient(#eceff4 0% 100%)';
    }

    this.barWidth = Math.max(0, Math.min(100, (this.scoreGeneral - 50) * 2));
    this.cdr.detectChanges();
  }

  async fetchCount(table: string, label: string, filter?: { gte?: [string, any] }) {
    const supabase = this.supabaseService.adminClient;
    let query = supabase.from(table).select('*', { count: 'exact', head: true });
    
    if (filter?.gte) {
      query = query.gte(filter.gte[0], filter.gte[1]);
    }

    const { count, error } = await query;
    if (!error) {
      this.updateStat(label, (count || 0).toString());
    }
  }

  updateStat(label: string, value: string) {
    const idx = this.stats.findIndex(s => s.label === label);
    if (idx !== -1) {
      this.stats[idx].value = value;
      this.cdr.detectChanges();
    }
  }

  async fetchAndUpdateScoreDistribution() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('score_final');

    if (error) {
      console.error('Error fetching score_employabilité distribution:', error);
      return;
    }

    if (data && data.length > 0) {
      const dist = [0, 0, 0, 0, 0];
      for (const row of data) {
        const score = row.score_final || 0;
        if (score >= 50 && score < 60) dist[0]++;
        else if (score >= 60 && score < 70) dist[1]++;
        else if (score >= 70 && score < 80) dist[2]++;
        else if (score >= 80 && score < 90) dist[3]++;
        else if (score >= 90 && score <= 100) dist[4]++;
      }

      const total = data.length || 1;
      this.distributionBins = [
        { range: '50-60', students: dist[0], percentage: Number(((dist[0] / total) * 100).toFixed(1)) },
        { range: '60-70', students: dist[1], percentage: Number(((dist[1] / total) * 100).toFixed(1)) },
        { range: '70-80', students: dist[2], percentage: Number(((dist[2] / total) * 100).toFixed(1)) },
        { range: '80-90', students: dist[3], percentage: Number(((dist[3] / total) * 100).toFixed(1)) },
        { range: '90-100', students: dist[4], percentage: Number(((dist[4] / total) * 100).toFixed(1)) },
      ];
      this.rebuildDistributionGrid(Math.max(...dist));
    }
    this.cdr.detectChanges();
  }

  setupRealtimeSubscription() {
    const supabase = this.supabaseService.adminClient;
    this.employabilitySubscription = supabase
      .channel('public:score_employabilité_score_admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'score_employabilité' }, payload => {
        this.fetchAndUpdateEmployabilityAverage();
        this.fetchAndUpdateScoreDistribution();
        this.fetchAndUpdateFiliereScore();
        this.fetchAndUpdateParcoursScore();
        this.fetchCount('score_employabilité', "Nombre d’étudiants inscrits sur la plateforme");
        this.fetchCount('score_employabilité', "Meilleurs profils (≥ 75%)", { gte: ['score_final', 75] });
      })
      .subscribe();
  }

  async fetchAndUpdateFiliereScore() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('parcours_type, filiere_licence, filiere_master, score_final');

    if (error) {
      console.error('Error fetching filiere stats:', error);
      return;
    }

    if (data && data.length > 0) {
      let l_t_sum = 0; let l_t_count = 0;
      let l_l_sum = 0; let l_l_count = 0;
      let m_s_sum = 0; let m_s_count = 0;
      let m_i_sum = 0; let m_i_count = 0;

      for (const row of data) {
        const type = row.parcours_type;
        let filiere = '';
        if (type === 'L') {
          filiere = row.filiere_licence || '';
        } else if (type === 'M' || type === 'LM') {
          filiere = row.filiere_master || '';
        }

        const score = row.score_final || 0;

        if (filiere === 'Licence_Sciences_de_Transport') {
          l_t_sum += score; l_t_count++;
        }
        else if (filiere === 'Licence_Génie_Logistique') {
          l_l_sum += score; l_l_count++;
        }
        else if (filiere === 'Master_Recherche_STL') {
          m_s_sum += score; m_s_count++;
        }
        else if (filiere === 'Master_Pro_Génie_Industriel_et_Logistique') {
          m_i_sum += score; m_i_count++;
        }
      }

      this.filiereStats = [
        {
          filiere: 'Licence Nationale en Génie Logistique: Logistique Industrielle',
          score: l_l_count > 0 ? Number((l_l_sum / l_l_count).toFixed(2)) : 0
        },
        {
          filiere: 'Licence Nationale en Sciences de Transport: Planification et Organisation des Transports',
          score: l_t_count > 0 ? Number((l_t_sum / l_t_count).toFixed(2)) : 0
        },
        {
          filiere: 'Master Professionnel Génie Industriel et Logistique',
          score: m_i_count > 0 ? Number((m_i_sum / m_i_count).toFixed(2)) : 0
        },
        {
          filiere: 'Mastère de Recherche en Économie Quantitative: Sciences des Transports et Logistique (STL)',
          score: m_s_count > 0 ? Number((m_s_sum / m_s_count).toFixed(2)) : 0
        }
      ];
      this.cdr.detectChanges();
    }
  }

  async fetchAndUpdateParcoursScore() {
    const supabase = this.supabaseService.adminClient;
    const { data, error } = await supabase
      .from('score_employabilité')
      .select('parcours_type, score_final');

    if (error) {
      console.error('Error fetching parcours stats:', error);
      return;
    }

    if (data && data.length > 0) {
      let l_sum = 0, l_count = 0;
      let m_sum = 0, m_count = 0;
      let lm_sum = 0, lm_count = 0;

      for (const row of data) {
        const type = row.parcours_type;
        const score = row.score_final || 0;
        if (type === 'L') { l_sum += score; l_count++; }
        else if (type === 'M') { m_sum += score; m_count++; }
        else if (type === 'LM') { lm_sum += score; lm_count++; }
      }

      this.niveauStats = [
        { niveau: 'L', score: l_count > 0 ? Number((l_sum / l_count).toFixed(2)) : 0 },
        { niveau: 'M', score: m_count > 0 ? Number((m_sum / m_count).toFixed(2)) : 0 },
        { niveau: 'LM', score: lm_count > 0 ? Number((lm_sum / lm_count).toFixed(2)) : 0 }
      ];
      this.cdr.detectChanges();
    }
  }

  readonly palette = ['#5baddb', '#8b5cf6', '#e06456', '#5dbf7a', '#f4a23b', '#2f8f83', '#1e2d5a', '#3b82f6'];

  getColor(index: number): string {
    return this.palette[index % this.palette.length];
  }

  /* ── 2. Score par filière ─────────────────────────────── */
  filiereStats: FiliereStat[] = [
    { filiere: 'Licence Nationale en Génie Logistique: Logistique Industrielle', score: 0 },
    { filiere: 'Licence Nationale en Sciences de Transport: Planification et Organisation des Transports', score: 0 },
    { filiere: 'Master Professionnel Génie Industriel et Logistique', score: 0 },
    { filiere: 'Mastère de Recherche en Économie Quantitative: Sciences des Transports et Logistique (STL)', score: 0 },
  ];

  /* ── 3. Distribution par niveau (Score Employabilité 0-100%) ── */
  niveauStats: NiveauStat[] = [
    { niveau: 'L', score: 0 },
    { niveau: 'M', score: 0 },
    { niveau: 'LM', score: 0 }
  ];

  /** Full labels used in tooltips */
  readonly niveauFullLabels: Record<string, string> = {
    'L': 'Licence',
    'M': 'Master',
    'LM': 'Licence et Master',
  };

  readonly yMax = 100;
  readonly yGridLines = [0, 25, 50, 75, 100];
  readonly yGridLinesReversed = [...this.yGridLines].reverse();
  readonly yGridLinesInner = this.yGridLines.slice(1).reverse();

  /* ── 4. Distribution des scores (score -> nombre d'étudiants) ── */
  distributionBins: DistributionBin[] = [
    { range: '50-60', students: 0, percentage: 0 },
    { range: '60-70', students: 0, percentage: 0 },
    { range: '70-80', students: 0, percentage: 0 },
    { range: '80-90', students: 0, percentage: 0 },
    { range: '90-100', students: 0, percentage: 0 },
  ];

  distributionYMax = 120;
  distributionGrid = [0, 30, 60, 90, 120];
  distributionGridReversed = [...this.distributionGrid].reverse();
  distributionGridInner = this.distributionGrid.slice(1).reverse();

  rebuildDistributionGrid(maxStudents: number) {
    this.distributionYMax = Math.max(10, Math.ceil(maxStudents * 1.2));
    const step = this.distributionYMax / 4;
    this.distributionGrid = [0, step, step * 2, step * 3, this.distributionYMax].map(v => Math.round(v));
    this.distributionGridReversed = [...this.distributionGrid].reverse();
    this.distributionGridInner = this.distributionGrid.slice(1).reverse();
  }

  /* ── helpers ─────────────────────────────────────────── */
  scoreClass(score: number): string {
    if (score >= 75) return 'chip chip-good';
    if (score >= 55) return 'chip chip-mid';
    return 'chip chip-low';
  }

  niveauBarPct(score: number): number {
    return (score / this.yMax) * 100;
  }

  gridLinePct(g: number): number {
    return (g / this.yMax) * 100;
  }

  distributionBarPct(value: number): number {
    return (value / this.distributionYMax) * 100;
  }

  distributionGridPct(g: number): number {
    return (g / this.distributionYMax) * 100;
  }

  trackByFiliere(_: number, f: FiliereStat): string { return f.filiere; }
  trackByNiveau(_: number, n: NiveauStat): string { return n.niveau; }
  trackByGrid(_: number, g: number): number { return g; }
  trackByDistribution(_: number, d: DistributionBin): string { return d.range; }
}
