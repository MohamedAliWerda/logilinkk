import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { VerifyComponent } from './verify.component';
import { DashboardComponent } from './dashboard.component';
import { CvAtsComponent } from './cv-ats.component';
import { ProfilComponent } from './profil.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  { path: 'verify', component: VerifyComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'cv-ats', component: CvAtsComponent },
  { path: 'profil', component: ProfilComponent },
];
