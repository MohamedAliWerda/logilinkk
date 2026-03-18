import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthApiService } from '../services/auth-api.service';

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

    // Quick client-side validation to provide immediate feedback
    const cinPassportRaw = this.loginForm.get('identifiant')?.value as string;
    const password = this.loginForm.get('password')?.value as string;
    const wrongCredentialsMessage = 'This account does not exist or password is wrong';

    if (!cinPassportRaw || !/^\d{4,}$/.test(cinPassportRaw.trim())) {
      // immediate feedback for clearly invalid identifier (avoid network call)
      this.authError = 'This account does not exist';
      this.isSubmitting = false;
      return;
    }

    // Quick client-side password validation to avoid server 400 and show error fast
    if (!password || password.trim().length < 6) {
      this.authError = 'Password is wrong';
      this.isSubmitting = false;
      return;
    }

    const safetyTimer = setTimeout(() => {
      if (this.isSubmitting) {
        this.isSubmitting = false;
        if (!this.authError) {
          this.authError = 'Password is wrong';
        }
      }
    }, 4000);

    try {
      const cinPassport = cinPassportRaw as string;
      const response = await this.authApiService.signIn(cinPassport, password);

      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      localStorage.setItem('role', response.data.user.role);

      if (response.data.user.role === 'admin') {
        await this.router.navigate(['/admin/dashboard']);
        return;
      }

      if (response.data.user.role === 'etudiant') {
        await this.router.navigate(['/home/dashboard']);
        return;
      }

      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      this.authError = 'Role utilisateur non autorise.';
    } catch (error) {
      const httpError = error as HttpErrorResponse;
      const serverMessage = this.extractErrorMessage(error);

      if (httpError.status === 401) {
        this.authError = serverMessage || 'Password is wrong';
      } else if (httpError.status === 400) {
        // Legacy validation responses are treated as credential errors for UX
        this.authError = 'Password is wrong';
      } else if (httpError.status === 0) {
        this.authError = 'Connexion impossible. Veuillez reessayer.';
      } else {
        this.authError = 'This account does not exist or password is wrong';
      }
    } finally {
      clearTimeout(safetyTimer);
      this.isSubmitting = false;
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

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

}
