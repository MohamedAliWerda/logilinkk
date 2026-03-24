import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { getSupabase } from '../config/supabase.client';
import { SignInDto } from './dto/signin.dto';

type UserRecord = {
  id: string;
  cin_passport: string;
  email: string;
  mot_de_passe: string;
  role: 'admin' | 'etudiant';
};

type ProfileEtudiantRecord = {
  nom?: string;
  prenom?: string;
  cin_passport?: number | string;
  nationalite?: string;
  ville?: string;
  sexe?: string;
  ville_naissance?: string;
  adresse?: string;
  code_postal?: number | string;
  telephone?: number | string;
  groupe?: string;
  niveau?: number | string;
  filiere?: string;
  departement?: string;
};

function looksLikeBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async signIn(signInDto: SignInDto) {
    const cinPassportValue = Number(signInDto.cin_passport.trim());
    if (!Number.isFinite(cinPassportValue)) {
      throw new UnauthorizedException('This account does not exist');
    }

    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('user')
      .select('id, cin_passport, email, mot_de_passe, role')
      .eq('cin_passport', cinPassportValue)
      .maybeSingle<UserRecord>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!user) {
      throw new UnauthorizedException('This account does not exist');
    }

    const passwordMatches = looksLikeBcryptHash(user.mot_de_passe)
      ? await bcrypt.compare(signInDto.mot_de_passe, user.mot_de_passe)
      : signInDto.mot_de_passe === user.mot_de_passe;

    if (!passwordMatches) {
      throw new UnauthorizedException('Password is wrong');
    }

    const payload = {
      sub: user.id,
      cin_passport: user.cin_passport,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    const { data: profile, error: profileError } = await supabase
      .from('profils_etudiant')
      .select('*')
      .eq('cin_passport', cinPassportValue)
      .maybeSingle<ProfileEtudiantRecord>();

    if (profileError) {
      throw new InternalServerErrorException(profileError.message);
    }

    return {
      message: 'Login successful',
      data: {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          cin_passport: user.cin_passport,
          ...(profile ?? {}),
        },
      },
    };
  }
}
