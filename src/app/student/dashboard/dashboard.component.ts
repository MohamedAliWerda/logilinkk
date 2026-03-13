import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StudentSidebarComponent } from '../student-sidebar/student-sidebar.component';
import { TopNavbarComponent } from '../../shared/top-navbar/top-navbar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StudentSidebarComponent, TopNavbarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  studentName = 'Nour';
  sidebarCollapsed = false;
  activeMenu = 'dashboard';
  matchingSearch = '';

  stats: { label: string; value: number; icon: SafeHtml }[];

  constructor(private router: Router, private sanitizer: DomSanitizer) {
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
      { label: 'Score CV',              value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[0]) },
      { label: 'Entreprises matchées',  value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[1]) },
      { label: 'Formations suggérées',  value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[2]) },
      { label: 'Gaps identifiés',       value: 0, icon: this.sanitizer.bypassSecurityTrustHtml(icons[3]) },
    ];
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
