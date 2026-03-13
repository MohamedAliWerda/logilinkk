import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { StudentSidebarComponent } from '../student-sidebar/student-sidebar.component';
import { TopNavbarComponent } from '../../shared/top-navbar/top-navbar.component';

@Component({
  selector: 'app-matching',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, StudentSidebarComponent, TopNavbarComponent],
  templateUrl: './matching.component.html',
  styleUrls: ['./matching.component.css'],
})
export class MatchingComponent {
  studentName = 'Nour';
  sidebarCollapsed = false;
  matchingSearch = '';

  matchingCompanies = [
    {
      name: 'Sotrapil',
      location: 'Sfax',
      score: 92,
      description: 'Leader tunisien du transport de produits pétroliers par pipeline.',
      tags: ['Logistique', 'Transport', 'SAP'],
      sector: 'Transport pétrolier',
      employees: '500+ employés',
      stage: 'Stage PFE',
    },
    {
      name: 'CTN',
      location: 'Tunis',
      score: 87,
      description: 'Compagnie nationale de navigation maritime.',
      tags: ['Maritime', 'Supply Chain', 'Commerce international'],
      sector: 'Transport maritime',
      employees: '1000+ employés',
      stage: 'Stage PFE',
    },
    {
      name: 'Tunisie Telecom',
      location: 'Tunis',
      score: 80,
      description: 'Optimisation des opérations supply chain et logistique telecom.',
      tags: ['Supply Chain', 'Data', 'ERP'],
      sector: 'Télécommunications',
      employees: '2000+ employés',
      stage: 'Stage ingénieur',
    },
    {
      name: 'STAM',
      location: 'Radès',
      score: 84,
      description: 'Gestion portuaire, transit et opérations de manutention.',
      tags: ['Portuaire', 'Transport', 'Opérations'],
      sector: 'Logistique portuaire',
      employees: '700+ employés',
      stage: 'Stage technicien',
    },
  ];

  get filteredMatchingCompanies() {
    const q = this.matchingSearch.trim().toLowerCase();
    if (!q) return this.matchingCompanies;
    return this.matchingCompanies.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)) ||
        c.sector.toLowerCase().includes(q)
    );
  }

  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
