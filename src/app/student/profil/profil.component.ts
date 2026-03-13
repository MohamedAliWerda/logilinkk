import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StudentSidebarComponent } from '../student-sidebar/student-sidebar.component';

@Component({
  selector: 'app-profil',
  standalone: true,
  imports: [CommonModule, RouterModule, StudentSidebarComponent],
  templateUrl: './profil.component.html',
  styleUrls: ['./profil.component.css']
})
export class ProfilComponent {
  constructor(private router: Router) {}

  logout() { this.router.navigate(['/']); }
  goToDashboard() { this.router.navigate(['/dashboard']); }
  goToMatching() { this.router.navigate(['/matching']); }
  goToStudentFormations() { this.router.navigate(['/student-formations']); }
  goToStudentCompetences() { this.router.navigate(['/student-competences']); }
  goToCvAts() { this.router.navigate(['/cv-ats']); }
}
