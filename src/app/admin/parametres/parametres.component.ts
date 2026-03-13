import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AdminSidebarComponent } from '../shared/admin-sidebar/admin-sidebar.component';
import { TopNavbarComponent } from '../../shared/top-navbar/top-navbar.component';

@Component({
  selector: 'app-parametres',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AdminSidebarComponent, TopNavbarComponent],
  templateUrl: './parametres.component.html',
  styleUrls: ['./parametres.component.css'],
})
export class ParametresComponent {
  sidebarCollapsed = false;

  admin = {
    fullName: 'Admin ISGI',
    email: 'admin@isgi.tn',
    phone: '+216 71 000 000',
    role: 'Administrateur principal',
  };

  notifications = {
    push: true,
    email: true,
  };

  platform = {
    autoMatching: true,
    darkMode: false,
    academicYear: '2024-2025',
    minCvScore: 60,
  };

  constructor(private router: Router) {}

  get adminName(): string {
    return this.admin.fullName;
  }

  logout() {
    this.router.navigate(['/']);
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }
}
