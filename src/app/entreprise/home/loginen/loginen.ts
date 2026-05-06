// ✅ login_entreprise.ts - imports corrects
import { Component } from '@angular/core';
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

  constructor(private fb: FormBuilder, private router: Router, private readonly supabase: SupabaseService) {
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
      return;
    }

    this.isSubmitting = true;
    this.authError = '';

    const { email, password } = this.loginForm.value;

    try {
      const societe: any = await this.supabase.findSocieteByCredentials(email, password);
      if (!societe) {
        this.authError = 'Email ou mot de passe incorrect.';
        return;
      }

      const situation = (societe.situation ?? '').toString().toLowerCase();
      if (situation.includes('en attente') || situation.includes('en_attente')) {
        // Block access until admin validation
        window.alert('Votre compte est en attente de validation par un administrateur. L\'accès est bloqué jusqu\'à la validation.');
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
      window.alert('Votre compte n\'est pas autorisé à accéder pour le moment.');
    } catch (err: any) {
      console.error('Login error', err);
      this.authError = 'Erreur lors de la connexion. Veuillez réessayer.';
    } finally {
      this.isSubmitting = false;
    }
  }
}