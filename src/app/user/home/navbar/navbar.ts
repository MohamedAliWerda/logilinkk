import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SidebarService } from '../sidebar/sidebar.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class Navbar implements OnInit {
  user: { name: string; avatarUrl: string | null } = {
    name: 'Nour',
    avatarUrl: null
  };

  constructor(
    private readonly router: Router,
    private readonly sidebarService: SidebarService
  ) {}

  ngOnInit(): void {
    this.ensureSidebarOpenByDefault();
  }

  toggleSidebar(): void {
    this.sidebarService.toggle();
  }

  goToProfile(): void {
    this.router.navigate(['/home/profil']);
  }

  logout(): void {
    this.router.navigate(['/login']);
  }

  private ensureSidebarOpenByDefault(): void {
    const service = this.sidebarService as any;

    if (typeof service.open === 'function') {
      service.open();
      return;
    }

    if (typeof service.setOpen === 'function') {
      service.setOpen(true);
      return;
    }

    if (typeof service.show === 'function') {
      service.show();
    }
  }
}