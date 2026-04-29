import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { EntrepriseApiService } from '../services/entreprise-api.service';

@Component({
  selector: 'app-register-entreprise',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CommonModule],
  templateUrl: './register-entreprise.html',
  styleUrls: ['./register-entreprise.css']
})
export class RegisterEntreprise {
  registerForm: FormGroup;
  hidePassword = true;
  isSubmitting = false;
  formError: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly entrepriseApiService: EntrepriseApiService,
  ) {
    this.registerForm = this.fb.group({
      nomEntreprise: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      adresse: ['', Validators.required],
      description: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.registerForm.invalid) {
      this.formError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    this.formError = null;
    this.isSubmitting = true;

    try {
      const payload = this.registerForm.value;
      const response = await this.entrepriseApiService.register(payload);
      localStorage.setItem('token', response.data.access_token);
      localStorage.setItem('entreprise', JSON.stringify(response.data.entreprise));
      localStorage.setItem('role', 'entreprise');
      await this.router.navigate(['/entreprise/offres']);
    } catch (error: any) {
      const msg = error?.error?.message;
      this.formError = typeof msg === 'string' ? msg : 'Une erreur est survenue. Veuillez réessayer.';
    } finally {
      this.isSubmitting = false;
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }
}
