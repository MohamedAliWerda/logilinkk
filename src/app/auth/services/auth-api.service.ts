import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type UserRole = 'admin' | 'etudiant';

type UserProfilePayload = {
  id: string;
  cin_passport: string;
  email: string;
  role: UserRole;
  nom?: string;
  prenom?: string;
  nationalite?: string;
  ville?: string;
  sexe?: string;
  ville_naissance?: string;
  adresse?: string;
  code_postal?: string | number;
  telephone?: string | number;
  groupe?: string;
  niveau?: string | number;
  filiere?: string;
  departement?: string;
};

type SignInResponse = {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    user: UserProfilePayload;
  };
};

@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly apiBaseUrl = 'http://localhost:3001';

  constructor(private readonly http: HttpClient) {}

  signIn(cinPassport: string, motDePasse: string): Promise<SignInResponse> {
    return firstValueFrom(
      this.http.post<SignInResponse>(`${this.apiBaseUrl}/auth/signin`, {
        cin_passport: cinPassport,
        mot_de_passe: motDePasse,
      }),
    );
  }
}