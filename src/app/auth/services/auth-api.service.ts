import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

type UserRole = 'admin' | 'etudiant';

type SignInResponse = {
  success: boolean;
  message: string;
  data: {
    access_token: string;
    user: {
      id: string;
      cin_passport: string;
      email: string;
      role: UserRole;
    };
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