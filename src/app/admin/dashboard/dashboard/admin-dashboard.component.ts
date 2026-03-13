import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminSidebarComponent } from '../../shared/admin-sidebar/admin-sidebar.component';
import { TopNavbarComponent } from '../../../shared/top-navbar/top-navbar.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AdminSidebarComponent, TopNavbarComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.css'],
})
export class AdminDashboardComponent {
  adminName = 'Nour';
  sidebarCollapsed = false;
  activeMenu = 'dashboard';
  showStudentsPopup = false;
  readonly barW = 34;

  stats = [
    { value: '247', label: 'Étudiants inscrits' },
    { value: '38', label: 'Entreprises partenaires' },
    { value: '24', label: 'Formations actives' },
    { value: '73%', label: 'Taux de matching' },
  ];

  donutLegend = [
    { color: '#1e2d5a', label: 'Logistique' },
    { color: '#f5a623', label: 'Transport' },
    { color: '#5baddb', label: 'Supply Chain' },
    { color: '#5dbf7a', label: 'Commerce Int.' },
  ];

  profileRecommendations = [
    {
      badge: 'Haute',
      title: 'Profil Logistique - marche dynamique',
      meta: 'Base sur la demande actuelle',
      btn: 'Voir details',
    },
    {
      badge: 'Moyenne',
      title: 'Profil Transport - postes ouverts',
      meta: 'Correspondance avec les entreprises',
      btn: 'Voir details',
    },
    {
      badge: 'Haute',
      title: 'Profil Supply Chain - competences cles',
      meta: 'Recommande pour renforcer le CV',
      btn: 'Voir details',
    },
  ];

  recentStudents = [
    { name: 'Ahmed Ben Ali',    id: 'ISGI2025-042', speciality: 'Logistique',    score: 85 },
    { name: 'Fatma Trabelsi',   id: 'ISGI2025-043', speciality: 'Transport',     score: 78 },
    { name: 'Mohamed Karray',   id: 'ISGI2025-044', speciality: 'Supply Chain',  score: 91 },
    { name: 'Sarra Gharbi',     id: 'ISGI2025-045', speciality: 'Logistique',    score: 67 },
    { name: 'Youssef Hammami',  id: 'ISGI2025-046', speciality: 'Commerce Int.', score: 74 },
  ];

  allStudents = [
    { name: 'Ahmed Ben Ali',    id: 'ISGI2025-042', speciality: 'Logistique',    score: 85 },
    { name: 'Fatma Trabelsi',   id: 'ISGI2025-043', speciality: 'Transport',     score: 78 },
    { name: 'Mohamed Karray',   id: 'ISGI2025-044', speciality: 'Supply Chain',  score: 91 },
    { name: 'Sarra Gharbi',     id: 'ISGI2025-045', speciality: 'Logistique',    score: 67 },
    { name: 'Youssef Hammami',  id: 'ISGI2025-046', speciality: 'Commerce Int.', score: 74 },
    { name: 'Nour Ben Hassen',  id: 'ISGI2025-047', speciality: 'Transport',     score: 83 },
    { name: 'Imen Chahed',      id: 'ISGI2025-048', speciality: 'Supply Chain',  score: 88 },
    { name: 'Walid Jebali',     id: 'ISGI2025-049', speciality: 'Logistique',    score: 79 },
    { name: 'Rim Khelifi',      id: 'ISGI2025-050', speciality: 'Commerce Int.', score: 81 },
    { name: 'Marouen Triki',    id: 'ISGI2025-051', speciality: 'Transport',     score: 72 },
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
    this.showStudentsPopup = true;
  }

  closeStudentsPopup() {
    this.showStudentsPopup = false;
  }

  donutSegments: { color: string; dashArray: string; dashOffset: number }[];
  barData: { month: string; x: number; y: number; height: number }[];
  yGridLines: { value: number; y: number }[];

  constructor(private router: Router) {
    // ── Donut chart ─────────────────────────────────────────────
    const C = 2 * Math.PI * 70; // ≈ 439.82
    const rawSegs = [
      { color: '#1e2d5a', pct: 0.4 },
      { color: '#f5a623', pct: 0.3 },
      { color: '#5baddb', pct: 0.2 },
      { color: '#5dbf7a', pct: 0.1 },
    ];
    let cum = 0;
    this.donutSegments = rawSegs.map((s) => {
      const seg = {
        color: s.color,
        dashArray: `${+(s.pct * C + 1).toFixed(2)} ${+C.toFixed(2)}`,
        dashOffset: +(C * (1 - cum)).toFixed(2),
      };
      cum += s.pct;
      return seg;
    });

    // ── Bar chart ────────────────────────────────────────────────
    const BAR_MAX = 260;
    const CHART_H = 245;
    const Y_BOTTOM = 265;
    const X_START = 50;
    const SLOT_W = 48;

    const rawBars = [
      { month: 'Sep', value: 5 },
      { month: 'Nov', value: 20 },
      { month: 'Jan', value: 70 },
      { month: 'Fév', value: 65 },
      { month: 'Mar', value: 90 },
      { month: 'Avr', value: 95 },
      { month: 'Mai', value: 130 },
      { month: 'Jun', value: 170 },
      { month: 'Jul', value: 255 },
      { month: 'Août', value: 195 },
    ];

    this.barData = rawBars.map((d, i) => {
      const h = Math.max(+(d.value / BAR_MAX * CHART_H).toFixed(2), 3);
      return {
        month: d.month,
        x: X_START + i * SLOT_W + (SLOT_W - this.barW) / 2,
        y: +(Y_BOTTOM - h).toFixed(2),
        height: h,
      };
    });

    this.yGridLines = [260, 195, 130, 65, 0].map((v) => ({
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
