// ✅ login_entreprise.ts - imports corrects
import { Component, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
@Component({
  selector: 'app-login-entreprise',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './loginen.html',
  styleUrls: ['./loginen.css'],
})
export class LoginEntrepriseComponent {
  loginForm: FormGroup;
  hidePassword = true;
  isSubmitting = false;
  authError = '';
  emailError = '';
  passwordError = '';
  pendingNotice: string | null = null;
  private pendingNoticeTimer: number | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private readonly supabase: SupabaseService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.authError = 'Veuillez remplir tous les champs correctement.';
      this.emailError = '';
      this.passwordError = '';
      this.cdr.detectChanges();
      return;
    }

    this.isSubmitting = true;
    this.cdr.detectChanges();
    this.authError = '';
    this.emailError = '';
    this.passwordError = '';
    this.clearPendingNotice();

    const { email, password } = this.loginForm.value;

    try {
      // First check if email exists
      const emailExists = await this.supabase.checkSocieteEmailExists(email);
      
      // Then try to login with both credentials
      const societe: any = await this.supabase.findSocieteByCredentials(email, password);
      
      if (!societe) {
        // Email doesn't exist OR password is wrong
        if (!emailExists) {
          this.emailError = 'Cet email n\'existe pas.';
        } else {
          // Email exists but password doesn't match
          this.passwordError = 'Le mot de passe est incorrect.';
        }
        this.isSubmitting = false;
        this.cdr.detectChanges();
        return;
      }

      const situation = (societe.situation ?? '').toString().toLowerCase();
      if (situation.includes('en attente') || situation.includes('en_attente')) {
        // Block access until admin validation
        this.isSubmitting = false;
        this.pendingNotice = 'Votre compte est en attente de validation par un administrateur. L\'accès est bloqué jusqu\'à la validation.';
        this.cdr.detectChanges();
        this.schedulePendingNoticeClear();
        return;
      }

      if (situation.includes('valid') || situation.includes('validée') || situation.includes('validee')) {
        // Successful login — persist minimal info and navigate
        localStorage.setItem('entreprise', JSON.stringify(societe));
        localStorage.setItem('role', 'entreprise');
        await this.router.navigate(['/entreprise/offres']);
        return;
      }

      // Fallback: deny access
      this.isSubmitting = false;
      this.authError = 'Votre compte n\'est pas autorisé à accéder pour le moment.';
      this.cdr.detectChanges();
    } catch (err: any) {
      console.error('Login error', err);
      this.authError = 'Erreur lors de la connexion. Veuillez réessayer.';
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  private clearPendingNotice(): void {
    this.pendingNotice = null;
    if (this.pendingNoticeTimer !== null) {
      window.clearTimeout(this.pendingNoticeTimer);
      this.pendingNoticeTimer = null;
    }
  }

  private schedulePendingNoticeClear(): void {
    if (this.pendingNoticeTimer !== null) {
      window.clearTimeout(this.pendingNoticeTimer);
    }

    this.pendingNoticeTimer = window.setTimeout(() => {
      this.clearPendingNotice();
    }, 5000);
  }
}