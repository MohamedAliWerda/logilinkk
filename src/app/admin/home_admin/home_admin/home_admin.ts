import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';

import { NavbarAdmin } from '../navbar_admin/navbar_admin';
import { SidebarAdmin } from '../sidebar_admin/sidebar_admin';
import { SidebarAdminService } from '../sidebar_admin/sidebar_admin.service';

@Component({
  selector: 'app-home-admin',
  standalone: true,
  imports: [CommonModule, AsyncPipe, RouterOutlet, NavbarAdmin, SidebarAdmin],
  templateUrl: './home_admin.html',
  styleUrls: ['./home_admin.css'],
})
export class HomeAdmin implements OnInit {
  isOpen!: Observable<boolean>;

  constructor(public sidebarService: SidebarAdminService) {}

  ngOnInit(): void {
    this.isOpen = this.sidebarService.isOpen$;
  }
}
