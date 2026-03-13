import { Component, Input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-student-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './student-sidebar.component.html',
  styleUrls: ['./student-sidebar.component.css'],
})
export class StudentSidebarComponent {
  @Input() collapsed = false;

  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/']);
  }
}
