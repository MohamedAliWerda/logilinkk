import { Routes } from '@angular/router';
import { Login } from './auth/login/login';
import { Verify } from './auth/verify/verify';
import { HomeComponent } from './user/home/home/home';
import { Dashboard } from './user/home/component/dashboard/dashboard';
import { Matching } from './user/home/component/matching/matching';
import { CvAts } from './user/home/component/cv-ats/cv-ats';
import { Profil } from './user/home/component/profil/profil';
import { Recommendation } from './user/home/component/recommendation/recommendation';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: Login },
  { path: 'verify', component: Verify },
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
];
