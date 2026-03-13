import { Component, Input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-admin-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './admin-sidebar.component.html',
  styleUrls: ['./admin-sidebar.component.css'],
})
export class AdminSidebarComponent {
  @Input() collapsed = false;

  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/']);
  }
}
