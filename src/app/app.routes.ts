import { Routes } from '@angular/router';
import { LoginComponent } from './AUTHENtification/login/login.component';
import { VerifyComponent } from './AUTHENtification/verif/verify.component';
import { DashboardComponent } from './student/dashboard/dashboard.component';
import { CvAtsComponent } from './student/cv_ats/cv-ats.component';
import { ProfilComponent } from './student/profil/profil.component';
import { AdminDashboardComponent } from './admin/dashboard/dashboard/admin-dashboard.component';
import { FormationsComponent } from './admin/formation/formations.component';
import { ParametresComponent } from './admin/parametres/parametres.component';
import { MatchingComponent } from './student/matching/matching.component';
import { StudentFormationsComponent } from './student/formation/student-formations.component';
import { StudentCompetencesComponent } from './student/competence/student-competences.component';

export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    children: [
      { path: '', redirectTo: 'login', pathMatch: 'full' },
      { path: 'login', component: LoginComponent },
      { path: 'verify', component: VerifyComponent },
    ],
  },
  { path: 'login', redirectTo: 'auth/login', pathMatch: 'full' },
  { path: 'verify', redirectTo: 'auth/verify', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'matching', component: MatchingComponent },
  { path: 'student-formations', component: StudentFormationsComponent },
  { path: 'student-competences', component: StudentCompetencesComponent },
  {
    path: 'admin',
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'dashboard', redirectTo: '', pathMatch: 'full' },
      { path: 'formations', component: FormationsComponent },
      { path: 'parametres', component: ParametresComponent },
    ],
  },
  { path: 'cv-ats', component: CvAtsComponent },
  { path: 'profil', component: ProfilComponent },
  { path: '**', redirectTo: 'auth/login' },
];
