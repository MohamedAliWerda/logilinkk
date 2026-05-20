import { Component, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../services/auth-api.service';
import { CvSubmissionService } from '../../user/home/component/cv-ats/cv-submission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
export class Login {
  loginForm: FormGroup;
  hidePassword: boolean = true;
  isSubmitting = false;
  authError: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly authApiService: AuthApiService,
    private readonly cvSubmissionService: CvSubmissionService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.loginForm = this.fb.group({
      identifiant: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) return;

    this.authError = null;
    this.isSubmitting = true;
    this.cdr.detectChanges();

    const cinPassportRaw = this.loginForm.get('identifiant')?.value as string;
    const password = this.loginForm.get('password')?.value as string;

    // Client-side format check
    if (!cinPassportRaw || !/^\d{4,}$/.test(cinPassportRaw.trim())) {
      this.authError = 'This account does not exist';
      this.isSubmitting = false;
      this.cdr.detectChanges(); // ✅ force UI update
      return;
    }

    try {
      const response = await this.authApiService.signIn(cinPassportRaw.trim(), password);

      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('role', response.data.user.role);

      if (response.data.user.role === 'admin') {
        await this.router.navigate(['/admin/dashboard']);
        return;
      }

      if (response.data.user.role === 'etudiant') {
        await this.navigateStudentAfterLogin();
        return;
      }

      // Unknown role — clean up and show error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      this.authError = 'Rôle utilisateur non autorisé.';

    } catch (error) {
      const httpError = error as HttpErrorResponse;
      const serverMessage = this.extractErrorMessage(error);

      if (httpError.status === 401) {
        this.authError = serverMessage || 'Identifiant ou mot de passe incorrect.';
      } else if (httpError.status === 400) {
        this.authError = 'Identifiant ou mot de passe incorrect.';
      } else if (httpError.status === 0) {
        this.authError = 'Connexion impossible. Veuillez réessayer.';
      } else {
        this.authError = 'Une erreur est survenue. Veuillez réessayer.';
      }

    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges(); // ✅ force UI update no matter what
    }
  }

  private extractErrorMessage(error: unknown): string {
    const httpError = error as HttpErrorResponse;
    const raw = httpError?.error;

    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw;
    }

    if (raw && typeof raw === 'object' && 'message' in raw) {
      const msg = (raw as { message?: unknown }).message;
      if (typeof msg === 'string' && msg.trim().length > 0) {
        return msg;
      }
      if (Array.isArray(msg)) {
        return msg.filter((v) => typeof v === 'string').join(', ');
      }
    }

    if (typeof httpError?.message === 'string' && httpError.message.trim().length > 0) {
      return httpError.message;
    }

    return '';
  }

  private async navigateStudentAfterLogin(): Promise<void> {
    try {
      const cv = await this.cvSubmissionService.fetchMyCv();
      if (cv) {
        await this.router.navigate(['/home/dashboard']);
        return;
      }
    } catch {
      // Fallback to onboarding path when CV status cannot be resolved.
    }

    await this.router.navigate(['/home/cv-landing']);
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }
}