import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-top-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './top-navbar.component.html',
  styleUrls: ['./top-navbar.component.css'],
})
export class TopNavbarComponent {
  @Input() userName = 'Nour';
  @Input() role: 'admin' | 'student' = 'student';
  @Input() logoSrc = 'assets/logo-preview.png';
  @Input() logoAlt = 'LogiLink';

  @Output() logoutClick = new EventEmitter<void>();
  @Output() menuToggle = new EventEmitter<void>();

  get roleLabel(): string {
    return this.role === 'admin' ? 'Admin' : 'Etudiant';
  }

  onLogout() {
    this.logoutClick.emit();
  }

  onMenuToggle() {
    this.menuToggle.emit();
  }
}
