import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StudentSidebarComponent } from '../student-sidebar/student-sidebar.component';
import { TopNavbarComponent } from '../../shared/top-navbar/top-navbar.component';

@Component({
  selector: 'app-student-formations',
  standalone: true,
  imports: [CommonModule, RouterModule, StudentSidebarComponent, TopNavbarComponent],
  templateUrl: './student-formations.component.html',
  styleUrls: ['./student-formations.component.css'],
})
export class StudentFormationsComponent {
  studentName = 'Ahmed Ben Ali';
  sidebarCollapsed = false;

  recommendedFormations = [
    {
      priority: 'Priorite haute',
      tone: 'high',
      title: 'SAP ERP - Module MM',
      source: 'SAP Learning Hub',
      duration: '4 semaines',
      description: 'Competence requise par 85% des entreprises matchees',
    },
    {
      priority: 'Priorite haute',
      tone: 'high',
      title: 'Power BI pour la logistique',
      source: 'Coursera',
      duration: '3 semaines',
      description: 'Gap identifie dans Data Analytics',
    },
    {
      priority: 'Priorite moyenne',
      tone: 'medium',
      title: 'Lean Six Sigma - Green Belt',
      source: 'edX',
      duration: '6 semaines',
      description: 'Amelioration continue dans la supply chain',
    },
    {
      priority: 'Priorite moyenne',
      tone: 'medium',
      title: 'Commerce international avance',
      source: 'ISGI',
      duration: 'Semestre 6',
      description: 'Prerequis pour specialisation TI',
    },
    {
      priority: 'Optionnelle',
      tone: 'optional',
      title: 'Management interculturel',
      source: 'OpenClassrooms',
      duration: '2 semaines',
      description: 'Soft skill valorisee a l international',
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
