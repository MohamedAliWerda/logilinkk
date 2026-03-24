import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  STUDENT_PROFILE_DATA,
  StudentProfileData,
} from '../../student-profile.data';
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
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = 'http://localhost:3001';
  private readonly supabaseUrl = 'https://kayhpmwnerluxfuaalmg.supabase.co';
  private readonly supabaseAnonKey = 'sb_publishable_LFi0AVotfY1GB3_4hv7hDg_VDy7QVwz';

  protected readonly activeSection = signal<'info' | 'password' | 'releve-notes'>('info');
  protected readonly passwordSaved = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly profileImageUrl = signal<string | null>(null);
  protected readonly profileImageError = signal<string | null>(null);

  protected profileData: StudentProfileData = this.buildProfileFromStorage();
  protected userName = this.profileData.displayName;
  protected profileStatus = this.profileData.status;
  protected profileSummaryItems = this.profileData.summaryItems;
  protected infoSectionTitle = this.profileData.infoSectionTitle;
  protected infoSectionSubtitle = this.profileData.infoSectionSubtitle;
  protected profileInfoGroups = this.profileData.infoGroups;

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

    void this.loadRemoteProfile();
  }

  private mergeProfileRecord(
    base: StudentProfileData,
    record: Record<string, unknown>,
  ): StudentProfileData {
    const pickText = (keys: string[]): string | null => {
      for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          return String(value);
        }
      }
      return null;
    };

    const fullName = [pickText(['prenom', 'firstName']), pickText(['nom', 'lastName'])]
      .filter((v): v is string => Boolean(v))
      .join(' ')
      .trim();

    return {
      ...base,
      displayName:
        fullName ||
        pickText(['displayName']) ||
        pickText(['email']) ||
        base.displayName,
      firstName:
        pickText(['prenom', 'firstName']) || base.firstName,
      lastName: pickText(['nom', 'lastName']) || base.lastName,
      summaryItems: base.summaryItems.map((item) => {
        const key = item.label.toLowerCase();
        if (key.includes('groupe')) {
          return {
            ...item,
            value: pickText(['groupe', 'groupe_etudiant', 'group', 'group_name']) || '-',
          };
        }
        if (key.includes('niveau')) {
          return { ...item, value: pickText(['niveau', 'level']) || '-' };
        }
        if (key.includes('filiere')) {
          return { ...item, value: pickText(['filiere', 'specialite']) || '-' };
        }
        if (key.includes('departement')) {
          return { ...item, value: pickText(['departement', 'department']) || '-' };
        }
        return item;
      }),
      infoGroups: base.infoGroups.map((group) => ({
        ...group,
        items: group.items.map((it) => {
          const label = it.label.toLowerCase();
          if (label.includes('nom') || label.includes('prenom')) {
            return { ...it, value: fullName || pickText(['displayName']) || base.displayName || '-' };
          }
          if (label.includes('sexe')) {
            return { ...it, value: pickText(['sexe', 'gender']) || '-' };
          }
          if (label.includes('cin') || label.includes('passport')) {
            return { ...it, value: pickText(['cin_passport', 'cinPassport']) || '-' };
          }
          if (label.includes('nationalite')) {
            return { ...it, value: pickText(['nationalite']) || '-' };
          }
          if (label.includes('ville de naissance')) {
            return {
              ...it,
              value: pickText(['ville_naissance', 'lieu_naissance']) || '-',
            };
          }
          if (label.includes('ville')) {
            return { ...it, value: pickText(['ville']) || '-' };
          }
          if (label.includes('adresse') || label.includes('adresse postale')) {
            return {
              ...it,
              value: pickText(['adresse_postale', 'adresse', 'address']) || '-',
            };
          }
          if (label.includes('code postal')) {
            return { ...it, value: pickText(['code_postal', 'zip']) || '-' };
          }
          if (label.includes('email')) {
            return { ...it, value: pickText(['email']) || '-' };
          }
          if (label.includes('telephone') || label.includes('téléphone')) {
            return { ...it, value: pickText(['telephone', 'phone']) || '-' };
          }
          return it;
        }),
      })),
    };
  }

  private buildProfileFromStorage(): StudentProfileData {
    const formatNameFromEmail = (email: string): string => {
      const local = email.split('@')[0] ?? '';
      const parts = local.split(/[._-]+/).filter(Boolean);
      if (parts.length === 0) return email;
      return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    };

    try {
      const raw = localStorage.getItem('user');
      if (!raw) return STUDENT_PROFILE_DATA;

      const parsed = JSON.parse(raw) as Record<string, unknown> | null;
      if (!parsed) return STUDENT_PROFILE_DATA;

      const displayNameFromFields =
        (typeof parsed['displayName'] === 'string' && parsed['displayName']) ||
        ((typeof parsed['prenom'] === 'string' || typeof parsed['nom'] === 'string')
          ? `${String(parsed['prenom'] ?? '')} ${String(parsed['nom'] ?? '')}`.trim()
          : undefined) ||
        ((typeof parsed['firstName'] === 'string' ||
          typeof parsed['lastName'] === 'string')
          ? `${String(parsed['firstName'] ?? '')} ${String(parsed['lastName'] ?? '')}`.trim()
          : undefined);

      const email = typeof parsed['email'] === 'string' ? parsed['email'] : undefined;
      const displayName = displayNameFromFields || (email ? formatNameFromEmail(email) : undefined);

      const base: StudentProfileData = {
        ...STUDENT_PROFILE_DATA,
        displayName: displayName ?? STUDENT_PROFILE_DATA.displayName,
        firstName:
          typeof parsed['firstName'] === 'string'
            ? parsed['firstName']
            : typeof parsed['prenom'] === 'string'
              ? parsed['prenom']
            : STUDENT_PROFILE_DATA.firstName,
        lastName:
          typeof parsed['lastName'] === 'string'
            ? parsed['lastName']
            : typeof parsed['nom'] === 'string'
              ? parsed['nom']
            : STUDENT_PROFILE_DATA.lastName,
        status:
          typeof parsed['status'] === 'string'
            ? parsed['status']
            : STUDENT_PROFILE_DATA.status,
        summaryItems: STUDENT_PROFILE_DATA.summaryItems.map((item) => ({
          ...item,
          value: '-',
        })),
        infoGroups: STUDENT_PROFILE_DATA.infoGroups.map((group) => ({
          ...group,
          items: group.items.map((it) => ({
            ...it,
            value: '-',
          })),
        })),
      };

      return this.mergeProfileRecord(base, parsed);
    } catch {
      return STUDENT_PROFILE_DATA;
    }
  }

  private applyProfileData(data: StudentProfileData): void {
    this.profileData = data;
    this.userName = data.displayName;
    this.profileStatus = data.status;
    this.profileSummaryItems = data.summaryItems;
    this.infoSectionTitle = data.infoSectionTitle;
    this.infoSectionSubtitle = data.infoSectionSubtitle;
    this.profileInfoGroups = data.infoGroups;
  }

  private async loadRemoteProfile(): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
      const resp = await firstValueFrom(
        this.http.get<{ success: boolean; data: unknown }>(
          `${this.apiBaseUrl}/profile`,
          { headers },
        ),
      );

      if (!resp || !resp.success || !resp.data) return;

      // Backward compatibility with previously nested backend shape: { data: { success, data } }
      let remote: Record<string, unknown> | null = null;
      if (typeof resp.data === 'object' && resp.data !== null && 'data' in (resp.data as Record<string, unknown>)) {
        const nested = (resp.data as Record<string, unknown>)['data'];
        if (nested && typeof nested === 'object') {
          remote = nested as Record<string, unknown>;
        }
      } else if (typeof resp.data === 'object' && resp.data !== null) {
        remote = resp.data as Record<string, unknown>;
      }

      if (!remote) {
        await this.loadSupabaseProfileFallback();
        return;
      }

      const merged: StudentProfileData = this.mergeProfileRecord(this.profileData, remote);
      this.applyProfileData(merged);
    } catch {
      await this.loadSupabaseProfileFallback();
    }
  }

  private async loadSupabaseProfileFallback(): Promise<void> {
    try {
      const rawUser = localStorage.getItem('user');
      if (!rawUser) return;
      const user = JSON.parse(rawUser) as Record<string, unknown>;
      const cin =
        typeof user['cin_passport'] === 'number'
          ? String(user['cin_passport'])
          : typeof user['cin_passport'] === 'string'
            ? user['cin_passport']
            : '';

      if (!cin) return;

      const headers = new HttpHeaders({
        apikey: this.supabaseAnonKey,
        Authorization: `Bearer ${this.supabaseAnonKey}`,
      });

      const url = `${this.supabaseUrl}/rest/v1/profils_etudiant?cin_passport=eq.${encodeURIComponent(cin)}&select=*`;
      const rows = await firstValueFrom(
        this.http.get<Record<string, unknown>[]>(url, { headers }),
      );

      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
      if (!row) return;

      const merged = this.mergeProfileRecord(this.profileData, row);
      this.applyProfileData(merged);
    } catch {
      // Keep current data if fallback also fails.
    }
  }

  public showInfoSection(): void {
    this.activeSection.set('info');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: null },
      queryParamsHandling: 'merge',
    });
  }

  public showPasswordSection(): void {
    this.activeSection.set('password');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: 'password' },
      queryParamsHandling: 'merge',
    });
  }

  public showReleveNotesSection(): void {
    this.activeSection.set('releve-notes');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { section: 'releve-notes' },
      queryParamsHandling: 'merge',
    });
  }

  public onProfileImageSelected(event: Event): void {
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

  public savePassword(): void {
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
