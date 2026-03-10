import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.css']
})
export class ProfilComponent {
  constructor(private router: Router) {}

  logout() { this.router.navigate(['/']); }
  goToDashboard() { this.router.navigate(['/dashboard']); }
  goToCvAts() { this.router.navigate(['/cv-ats']); }
}
