import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { getSupabase } from '../config/supabase.client';

@Injectable()
export class ProfileService {
  async getByCin(cinPassport: number) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('profils_etudiant')
      .select('*')
      .eq('cin_passport', cinPassport)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    return data || null;
  }
}
