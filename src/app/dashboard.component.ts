import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent {
  studentName = 'Étudiant';
  activeMenu = 'dashboard';

  stats = [
    { label: 'Score CV',              value: 0, icon: '⭐' },
    { label: 'Entreprises matchées',  value: 0, icon: '🏢' },
    { label: 'Formations suggérées',  value: 0, icon: '📖' },
    { label: 'Gaps identifiés',       value: 0, icon: '📈' },
  ];

  companies = [
    { name: 'Sotrapil', location: 'Sfax', sector: 'Transport pétrolier', match: 92 },
    { name: 'CTN',      location: 'Tunis', sector: 'Transport maritime', match: 87 },
  ];

  skills = [
    { name: 'SAP ERP',               current: 30, required: 80 },
    { name: 'Gestion des stocks',    current: 55, required: 90 },
    { name: 'Anglais professionnel', current: 60, required: 85 },
  ];

  constructor(private router: Router) {}

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
}
