import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-settings-admin',
  imports: [CommonModule, FormsModule],
  templateUrl: './settings_admin.html',
  styleUrl: './settings_admin.css',
})
export class SettingsAdmin {
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
