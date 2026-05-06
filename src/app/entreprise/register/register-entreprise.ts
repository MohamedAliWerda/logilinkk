import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SupabaseService } from '../../services/supabase.service';

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
    private readonly supabaseService: SupabaseService,
  ) {
    this.registerForm = this.fb.group({
      nomEntreprise: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8)]],
      adresse: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  isFieldInvalid(field: string): boolean {
    const control = this.registerForm.get(field);
    return !!(control && control.invalid && control.touched);
  }

  async onSubmit(): Promise<void> {
    console.log('📋 onSubmit called');
    if (this.registerForm.invalid) {
      console.log('📋 Form invalid');
      this.registerForm.markAllAsTouched();
      this.formError = 'Veuillez remplir tous les champs obligatoires.';
      return;
    }

    this.formError = null;
    this.isSubmitting = true;

    const timeoutHandle = window.setTimeout(() => {
      console.error('❌ Submit timed out after 15 seconds');
      this.isSubmitting = false;
      this.formError = 'Délai d\'attente dépassé. Vérifiez votre connexion et réessayez.';
    }, 15000);

    try {
      const payload = this.registerForm.getRawValue();
      console.log('📋 Payload:', payload);
      console.log('📋 Calling createSociete...');
      await this.supabaseService.createSociete(payload);
      clearTimeout(timeoutHandle);
      console.log('✅ createSociete succeeded, navigating...');
      await this.router.navigate(['/entreprise/loginen']);
    } catch (error: any) {
      clearTimeout(timeoutHandle);
      console.error('❌ Error in onSubmit:', error);
      const msg = error?.message ?? error?.error?.message ?? String(error);
      const details = error?.details;
      const hint = error?.hint;
      const fullError = [msg, details, hint].filter(Boolean).join(' | ');
      this.formError = fullError || 'Impossible d\'enregistrer la societe pour le moment. Verifiez la connexion et reessayez.';
      console.log('❌ Form error set:', this.formError);
    } finally {
      this.isSubmitting = false;
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword = !this.hidePassword;
  }
}