import { Component, OnInit } from '@angular/core';
import { CommonModule, AsyncPipe } from '@angular/common';

import { Navbar } from '../navbar/navbar';
import { Sidebar } from '../sidebar/sidebar';
import { CvAts } from '../component/cv-ats/cv-ats';
import { Matching } from '../component/matching/matching';
import { Recommendation } from '../component/recommendation/recommendation';
import { SidebarService } from '../sidebar/sidebar.service';

import { Observable } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    AsyncPipe,
    Navbar,
    Sidebar,
    CvAts,
    Matching,
    Recommendation
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css']
})
export class HomeComponent implements OnInit {
  isOpen!: Observable<boolean>;
  activeItem!: Observable<string>;

  constructor(public sidebarService: SidebarService) {}

  ngOnInit() {
    this.isOpen     = this.sidebarService.isOpen$;
    this.activeItem = this.sidebarService.activeItem$;
  }
}