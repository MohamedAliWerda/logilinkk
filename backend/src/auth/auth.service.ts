import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
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

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async signIn(signInDto: SignInDto) {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('user')
      .select('id, cin_passport, email, mot_de_passe, role')
      .eq('email', signInDto.email)
      .maybeSingle<UserRecord>();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordMatches = await bcrypt.compare(signInDto.mot_de_passe, user.mot_de_passe);
    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      data: {
        access_token: accessToken,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          cin_passport: user.cin_passport,
        },
      },
    };
  }
}
