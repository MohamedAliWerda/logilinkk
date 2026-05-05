import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { inject } from '@angular/core';

import { Navbar } from '../navbar/navbar';
import { Sidebar } from '../sidebar/sidebar';
import { SidebarService } from '../sidebar/sidebar.service';

import { Observable } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    RouterOutlet,
    Navbar,
    Sidebar,
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
  sidebarService = inject(SidebarService);
  isOpen!: Observable<boolean>;

  ngOnInit() {
    this.isOpen = this.sidebarService.isOpen$;
  }
}