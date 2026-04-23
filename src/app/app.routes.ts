import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Verify } from './auth/verify/verify';
import { ForgetPasswordComponent } from './auth/forgot-pass/forget-password.component';
import { VerifyCodeComponent } from './auth/forgot-pass/verify-code.component';
import { ResetPasswordComponent } from './auth/forgot-pass/reset-password.component';
import { HomeComponent } from './user/home/home/home';
import { Dashboard } from './user/home/component/dashboard/dashboard';
import { Matching } from './user/home/component/matching/matching';
import { CvAts } from './user/home/component/cv-ats/cv-ats';
import { CvLanding } from './user/home/component/cv-landing/cv-landing';
import { Profil } from './user/home/component/profil/profil';
import { Recommendation } from './user/home/component/recommendation/recommendation';
import { HomeAdmin } from './admin/home_admin/home_admin/home_admin';
import { DashboardAdmin } from './admin/home_admin/comonent_admin/dashboard_admin/dashboard_admin';
import { FormationsAdmin } from './admin/home_admin/comonent_admin/formations_admin/formations_admin';
import { SettingsAdmin } from './admin/home_admin/comonent_admin/settings_admin/settings_admin';
import { MetierAdmin } from './admin/home_admin/comonent_admin/metier_admin/metier_admin';
import { GapsAdmin } from './admin/home_admin/comonent_admin/gaps_admin/gaps_admin';
import { cvCreatedGuard } from './user/home/guards/cv-created.guard';


export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'verify', component: Verify },
  { path: 'forgot-password', component: ForgetPasswordComponent },
  { path: 'verify-code', component: VerifyCodeComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  {
    path: 'home',
    component: HomeComponent,
    children: [
      { path: '', redirectTo: 'cv-landing', pathMatch: 'full' },
      { path: 'cv-landing', component: CvLanding },
      { path: 'dashboard', component: Dashboard, canActivate: [cvCreatedGuard] },
      { path: 'matching', component: Matching, canActivate: [cvCreatedGuard] },
      { path: 'cv-ats', component: CvAts },
      { path: 'profil', component: Profil, canActivate: [cvCreatedGuard] },
      { path: 'recommendation', component: Recommendation, canActivate: [cvCreatedGuard] },
    ]
  },
  {
    path: 'admin',
    component: HomeAdmin,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardAdmin },
      { path: 'formations', component: FormationsAdmin },
      {
        path: 'matrice',
        loadComponent: () =>
          import('./admin/home_admin/comonent_admin/matrice_admin').then(
            (module) => module.MatriceAdmin
          ),
      },
      {
        path: 'score',
        loadComponent: () =>
          import('./admin/home_admin/comonent_admin/score_admin').then(
            (module) => module.ScoreAdmin
          ),
      },
      {
        path: 'metier',
        loadComponent: () =>
          import('./admin/home_admin/comonent_admin/metier_admin').then(
            (module) => module.MetierAdmin
          ),
      },
      {
        path: 'gaps',
        loadComponent: () =>
          import('./admin/home_admin/comonent_admin/gaps_admin').then(
            (module) => module.GapsAdmin
          ),
      },
      {
        path: 'etud',
        loadComponent: () =>
          import('./admin/home_admin/comonent_admin/etud_admin/etud_admin').then(
            (module) => module.EtudAdmin
          ),
      },
      {
        path: 'validation',
        loadComponent: () =>
          import('./admin/home_admin/comonent_admin/validation_admin/validation_admin').then(
            (module) => module.ValidationAdmin
          ),
      },
      { path: 'settings', component: SettingsAdmin },
    ],
  },
];
