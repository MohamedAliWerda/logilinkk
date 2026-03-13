import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StudentSidebarComponent } from '../student-sidebar/student-sidebar.component';
import { TopNavbarComponent } from '../../shared/top-navbar/top-navbar.component';

@Component({
  selector: 'app-student-competences',
  standalone: true,
  imports: [CommonModule, RouterModule, StudentSidebarComponent, TopNavbarComponent],
  templateUrl: './student-competences.component.html',
  styleUrls: ['./student-competences.component.css'],
})
export class StudentCompetencesComponent {
  studentName = 'Ahmed Ben Ali';
  sidebarCollapsed = false;

  missingCount = 6;
  averageLevel = 80;

  missingCompetences = [
    {
      title: 'SAP ERP (MM/WM)',
      source: 'Formation SAP Learning Hub - 4 semaines',
      level: 'Haute',
      tone: 'high',
    },
    {
      title: 'Data Analytics & Power BI',
      source: 'Cours Coursera - Data Analytics for Supply Chain',
      level: 'Haute',
      tone: 'high',
    },
    {
      title: 'Anglais professionnel (B2+)',
      source: 'Preparation TOEIC - British Council',
      level: 'Haute',
      tone: 'high',
    },
    {
      title: 'Management d equipe',
      source: 'Module ISGI - Semestre 4',
      level: 'Moyenne',
      tone: 'medium',
    },
    {
      title: 'Lean Six Sigma',
      source: 'Certification Green Belt - edX',
      level: 'Moyenne',
      tone: 'medium',
    },
    {
      title: 'Gestion de projet agile',
      source: 'Atelier pratique - 2 semaines',
      level: 'Moyenne',
      tone: 'medium',
    },
  ];

  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
