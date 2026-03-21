import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { STUDENT_PROFILE_DATA } from '../../student-profile.data';
import { ReleveNotes as ReleveNotesComponent } from './releve-notes/releve-notes';

@Component({
  selector: 'app-profil',
  imports: [CommonModule, ReactiveFormsModule, ReleveNotesComponent],
  templateUrl: './profil.html',
  styleUrl: './profil.css',
})
export class Profil {
  private static readonly maxProfileImageSize = 5 * 1024 * 1024;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly activeSection = signal<'info' | 'password' | 'releve-notes'>('info');
  protected readonly passwordSaved = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly profileImageUrl = signal<string | null>(null);
  protected readonly profileImageError = signal<string | null>(null);
  protected readonly profileData = STUDENT_PROFILE_DATA;
  protected readonly userName = this.profileData.displayName;
  protected readonly profileStatus = this.profileData.status;
  protected readonly profileSummaryItems = this.profileData.summaryItems;
  protected readonly infoSectionTitle = this.profileData.infoSectionTitle;
  protected readonly infoSectionSubtitle = this.profileData.infoSectionSubtitle;
  protected readonly profileInfoGroups = this.profileData.infoGroups;

  protected readonly passwordForm = this.formBuilder.nonNullable.group({
    currentPassword: ['', [Validators.required, Validators.minLength(8)]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected readonly passwordsMismatch = computed(() => {
    const { newPassword, confirmPassword } = this.passwordForm.getRawValue();
    return newPassword !== confirmPassword;
  });

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const section = params.get('section');
      if (section === 'password') {
        this.activeSection.set('password');
      } else if (section === 'releve-notes') {
        this.activeSection.set('releve-notes');
      } else {
        this.activeSection.set('info');
      }
      this.passwordSaved.set(false);
      this.passwordError.set(null);
    });
  }

  protected showInfoSection(): void {
    this.activeSection.set('info');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: null },
      queryParamsHandling: 'merge',
    });
  }

  protected showPasswordSection(): void {
    this.activeSection.set('password');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: 'password' },
      queryParamsHandling: 'merge',
    });
  }

  protected showReleveNotesSection(): void {
    this.activeSection.set('releve-notes');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: 'releve-notes' },
      queryParamsHandling: 'merge',
    });
  }

  protected onProfileImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    this.profileImageError.set(null);

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.profileImageError.set('Veuillez selectionner une image valide.');
      input.value = '';
      return;
    }

    if (file.size > Profil.maxProfileImageSize) {
      this.profileImageError.set('L image doit etre inferieure a 5 Mo.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      this.profileImageUrl.set(typeof result === 'string' ? result : null);
      input.value = '';
    };
    reader.onerror = () => {
      this.profileImageError.set('Impossible de charger cette image.');
      input.value = '';
    };

    reader.readAsDataURL(file);
  }

  protected savePassword(): void {
    this.passwordSaved.set(false);
    this.passwordError.set(null);

    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    if (this.passwordsMismatch()) {
      this.passwordError.set('La confirmation du mot de passe ne correspond pas.');
      return;
    }

    this.passwordSaved.set(true);
    this.passwordForm.reset({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
  }
}
