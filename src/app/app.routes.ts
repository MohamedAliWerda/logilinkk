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
import { Profil } from './user/home/component/profil/profil';
import { Recommendation } from './user/home/component/recommendation/recommendation';
import { HomeAdmin } from './admin/home_admin/home_admin/home_admin';
import { DashboardAdmin } from './admin/home_admin/comonent_admin/dashboard_admin/dashboard_admin';
import { FormationsAdmin } from './admin/home_admin/comonent_admin/formations_admin/formations_admin';
import { SettingsAdmin } from './admin/home_admin/comonent_admin/settings_admin/settings_admin';


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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: Dashboard },
      { path: 'matching', component: Matching },
      { path: 'cv-ats', component: CvAts },
      { path: 'profil', component: Profil },
      { path: 'recommendation', component: Recommendation },
    ]
  },
  {
    path: 'admin',
    component: HomeAdmin,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardAdmin },
      { path: 'formations', component: FormationsAdmin },
      { path: 'settings', component: SettingsAdmin },
    ],
  },
];
