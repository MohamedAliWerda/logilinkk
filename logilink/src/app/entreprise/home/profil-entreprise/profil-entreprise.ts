import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';

export interface Entreprise {
  nomEntreprise: string;
  email: string;
  telephone: string;
  adresse: string;
  description?: string;
}

@Component({
  selector: 'app-profil-entreprise',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './profil-entreprise.html',
  styleUrls: ['./profil-entreprise.css']
})
export class ProfilEntreprise implements OnInit {
  profil: Entreprise | null = null;
  isLoading = false;
  isSaving = false;
  isEditing = false;
  successMessage = '';
  errorMessage = '';

  profilForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.profilForm = this.fb.group({
      nomEntreprise: ['', [Validators.required, Validators.maxLength(200)]],
      email: ['', [Validators.required, Validators.email]],
      telephone: ['', Validators.required],
      adresse: ['', Validators.required],
      description: ['']
    });
  }

  ngOnInit() {
    this.loadProfil();
  }

  loadProfil() {
    this.isLoading = true;

    // Données mockées — remplacez par votre source de données
    this.profil = {
      nomEntreprise: 'LogiLink',
      email: 'contact@logilink.tn',
      telephone: '+216 71 234 567',
      adresse: 'Sfax, Tunisie',
      description: 'Entreprise spécialisée dans la logistique et le transport.'
    };

    this.profilForm.patchValue({
      nomEntreprise: this.profil.nomEntreprise,
      email: this.profil.email,
      telephone: this.profil.telephone,
      adresse: this.profil.adresse,
      description: this.profil.description || ''
    });

    this.isLoading = false;
  }

  enableEdit() {
    this.isEditing = true;
    this.successMessage = '';
    this.errorMessage = '';
  }

  cancelEdit() {
    this.isEditing = false;
    if (this.profil) {
      this.profilForm.patchValue({
        nomEntreprise: this.profil.nomEntreprise,
        email: this.profil.email,
        telephone: this.profil.telephone,
        adresse: this.profil.adresse,
        description: this.profil.description || ''
      });
    }
  }

  saveProfil() {
    if (this.profilForm.invalid) return;
    this.isSaving = true;
    this.successMessage = '';
    this.errorMessage = '';

    // Sauvegarde en mémoire
    this.profil = { ...this.profilForm.value };
    this.isEditing = false;
    this.isSaving = false;
    this.successMessage = 'Profil mis à jour avec succès !';
    setTimeout(() => this.successMessage = '', 3000);
  }

  getInitials(): string {
    if (!this.profil?.nomEntreprise) return '?';
    return this.profil.nomEntreprise
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }
}