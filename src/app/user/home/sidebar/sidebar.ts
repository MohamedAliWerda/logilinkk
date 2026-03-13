import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import {
  trigger,
  state,
  style,
  animate,
  transition,
  query,
  stagger
} from '@angular/animations';
import { Subscription } from 'rxjs';
import { SidebarService } from './sidebar.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  animations: [
    // Container animation (overlay, no layout push)
    trigger('slideInOut', [
      state(
        'open',
        style({
          transform: 'translateX(0)',
          opacity: 1,
          visibility: 'visible',
          pointerEvents: 'auto'
        })
      ),
      state(
        'closed',
        style({
          transform: 'translateX(-20px)',
          opacity: 0,
          visibility: 'hidden',
          pointerEvents: 'none'
        })
      ),
      transition('closed => open', [
        style({ visibility: 'visible' }),
        animate('300ms ease-out')
      ]),
      transition('open => closed', [animate('220ms ease-in')])
    ]),

    // Menu items stagger on open
    trigger('listAnimation', [
      transition('closed => open', [
        query(
          '.nav-item',
          [
            style({ opacity: 0, transform: 'translateX(-8px)' }),
            stagger(40, [animate('200ms ease-out', style({ opacity: 1, transform: 'translateX(0)' }))])
          ],
          { optional: true }
        )
      ])
    ])
  ]
})
export class Sidebar implements OnInit, OnDestroy {
  isOpen = true;
  private sub?: Subscription;

  constructor(
    private readonly sidebarService: SidebarService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    // Open by default on layout load
    this.sidebarService.open();

    this.sub = this.sidebarService.isOpen$.subscribe((open) => {
      this.isOpen = open;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  logout(): void {
    this.router.navigate(['/login']);
  }
}