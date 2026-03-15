import { Component, ElementRef, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import {
  trigger,
  transition,
  query,
  style,
  stagger,
  animate,
} from '@angular/animations';
import { SidebarService } from './sidebar.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'closeProfileMenu()',
  },
  animations: [
    trigger('listAnimation', [
      transition('* => *', [
        query(
          '.nav-item',
          [
            style({ opacity: 0, transform: 'translateX(-15px)' }),
            stagger(50, [
              animate(
                '250ms ease',
                style({ opacity: 1, transform: 'translateX(0)' })
              ),
            ]),
          ],
          { optional: true }
        ),
      ]),
    ]),
  ],
})
export class Sidebar implements OnInit, OnDestroy {
  @ViewChild('profileMenuWrapper')
  private profileMenuWrapper?: ElementRef<HTMLElement>;

  isOpen = true;
  profileMenuOpen = false;
  profilePopupTop = 0;
  profilePopupLeft = 0;
  private sub!: Subscription;

  menuItems = [
    {
      key: 'dashboard',
      label: 'Tableau de bord',
      route: '/home/dashboard',
      exact: true,
      icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="8" height="8" rx="1.5"/>
        <rect x="13" y="3" width="8" height="8" rx="1.5"/>
        <rect x="3" y="13" width="8" height="8" rx="1.5"/>
        <rect x="13" y="13" width="8" height="8" rx="1.5"/>
      </svg>`,
    },
    {
      key: 'cv-ats',
      label: 'CV ATS',
      route: '/home/cv-ats',
      exact: false,
      icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>`,
    },
    {
      key: 'matching',
      label: 'Matching / Gap',
      route: '/home/matching',
      exact: false,
      icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
      </svg>`,
    },
    {
      key: 'recommendation',
      label: 'Recommandations',
      route: '/home/recommendation',
      exact: false,
      icon: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>`,
    },
  ];

  constructor(
    private readonly sidebarService: SidebarService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.sidebarService.open();
    this.sub = this.sidebarService.isOpen$.subscribe((open) => {
      this.isOpen = open;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  navigateTo(route: string): void {
    this.closeProfileMenu();
    this.router.navigate([route]);
    this.sidebarService.close();
  }

  toggleProfileMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.profileMenuOpen = !this.profileMenuOpen;

    if (this.profileMenuOpen) {
      this.positionProfilePopup();
    }
  }

  closeProfileMenu(): void {
    this.profileMenuOpen = false;
  }

  onDocumentClick(event: MouseEvent): void {
    const wrapper = this.profileMenuWrapper?.nativeElement;
    const target = event.target as Node | null;

    if (!wrapper || !target) {
      this.closeProfileMenu();
      return;
    }

    if (wrapper.contains(target)) {
      return;
    }

    this.closeProfileMenu();
  }

  private positionProfilePopup(): void {
    const wrapper = this.profileMenuWrapper?.nativeElement;
    if (!wrapper) {
      return;
    }

    const rect = wrapper.getBoundingClientRect();
    const popupWidth = 230;
    const popupHeight = 112;
    const gap = 8;
    const verticalOffset = 10;

    const left = this.isOpen ? rect.left : rect.right + gap;
    let top = this.isOpen
      ? rect.top - popupHeight - gap + verticalOffset
      : rect.bottom - popupHeight + verticalOffset;

    if (top < gap) {
      top = rect.bottom + gap;
    }

    if (top + popupHeight > window.innerHeight - gap) {
      top = Math.max(gap, window.innerHeight - popupHeight - gap);
    }

    const maxLeft = window.innerWidth - popupWidth - gap;
    this.profilePopupLeft = Math.min(Math.max(gap, left), Math.max(gap, maxLeft));
    this.profilePopupTop = top;
  }

  isProfileRouteActive(): boolean {
    return this.router.url.startsWith('/home/profil');
  }

  goToProfile(): void {
    this.closeProfileMenu();
    this.router.navigate(['/home/profil']);
    this.sidebarService.close();
  }

  goToChangePassword(): void {
    this.closeProfileMenu();
    this.router.navigate(['/home/profil'], {
      queryParams: { section: 'password' },
    });
    this.sidebarService.close();
  }
}