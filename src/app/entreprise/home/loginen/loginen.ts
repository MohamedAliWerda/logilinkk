// ✅ login_entreprise.ts - imports corrects
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
@Component({
  selector: 'app-login-entreprise',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './loginen.html',  // ← changer ici
  styleUrl: './loginen.css',      // ← changer ici aussi
})
export class LoginEntrepriseComponent {
  loginForm: FormGroup;
  hidePassword = true;
  isSubmitting = false;
  authError = '';

  constructor(private fb: FormBuilder, private router: Router) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.authError = 'Veuillez remplir tous les champs correctement.';
      return;
    }
    this.isSubmitting = true;
    this.authError = '';

    // TODO: Appeler votre AuthService pour entreprise
    // this.authService.loginEntreprise(this.loginForm.value).subscribe(...)

    setTimeout(() => {
      this.isSubmitting = false;
      this.router.navigate(['/entreprise/offres']);
    }, 1000);
  }
}