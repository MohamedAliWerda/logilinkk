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