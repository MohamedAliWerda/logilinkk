import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SidebarService } from '../sidebar/sidebar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {
  /**
   * Extend this object (or inject an AuthService) if you need
   * to load the real user from a backend/token.
   */
  user: { name: string; avatarUrl: string | null } = {
    name: 'Nour',
    avatarUrl: null,
  };

  constructor(
    private readonly router: Router,
    private readonly sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.sidebarService.open();

    // Try to read the logged-in user from localStorage and update the displayed name.
    function formatNameFromEmail(email: string): string {
      const local = email.split('@')[0];
      const parts = local.split(/[._-]+/).filter(Boolean);
      if (parts.length === 0) return email;
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    try {
      const raw = localStorage.getItem('user');
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown> | null;
        if (parsed) {
          const displayNameFromFields =
            (typeof parsed['displayName'] === 'string' && parsed['displayName']) ||
            ((typeof parsed['firstName'] === 'string' || typeof parsed['lastName'] === 'string')
              ? `${String(parsed['firstName'] ?? '')} ${String(parsed['lastName'] ?? '')}`.trim()
              : undefined);

          const email = typeof parsed['email'] === 'string' ? parsed['email'] : undefined;
          const displayName = displayNameFromFields || (email ? formatNameFromEmail(email) : undefined);

          if (displayName) {
            this.user.name = displayName;
          }

          if (typeof parsed['avatarUrl'] === 'string') {
            this.user.avatarUrl = parsed['avatarUrl'];
          }
        }
      }
    } catch {
      // If parsing fails, keep default user object.
    }
  }

  /** Toggles the sidebar open/closed via the shared service. */
  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

  goToProfile(): void {
    this.router.navigate(['/home/profil']);
  }

  logout(): void {
    localStorage.removeItem('token');
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
}