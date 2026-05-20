import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';

import { NavbarEntreprise } from '../navbar_entreprise/navbar_entreprise';
import { SidebarEntreprise } from '../sidebar_entreprise/sidebar_entreprise';
import { SidebarEntrepriseService } from '../sidebar_entreprise/sidebar_entreprise.service';

@Component({
  selector: 'app-home-entreprise',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    RouterOutlet,
    NavbarEntreprise,
    SidebarEntreprise,
  ],
  templateUrl: './home-entreprise.html',
  styleUrls: ['./home-entreprise.css'],
})
export class HomeEntreprise implements OnInit {
  isOpen!: Observable<boolean>;

  constructor(public sidebarService: SidebarEntrepriseService) {}

  ngOnInit(): void {
    this.isOpen = this.sidebarService.isOpen$;
  }
}