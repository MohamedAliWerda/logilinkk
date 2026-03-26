import { Body, Controller, HttpException, HttpStatus, Post, UseGuards, Req } from '@nestjs/common';
import { CvSubmissionService } from './cv-submission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getSupabase } from '../config/supabase.client';

@Controller('cv-submissions')
export class CvSubmissionController {
  constructor(private readonly svc: CvSubmissionService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() payload: any) {
    const user = req.user as { sub?: string } | undefined;
    let authId = user?.sub;
    if (!authId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // If `sub` is not a UUID (e.g., numeric legacy id), resolve to the user's `auth_id` UUID
    const isUuid = (val?: string) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    try {
      if (!isUuid(authId)) {
        const supabase = getSupabase();
        const { data: userRow, error: userErr } = await supabase
          .from('user')
          .select('auth_id')
          .eq('id', Number(authId))
          .maybeSingle();

        if (userErr) {
          console.error('[cv-submissions] failed to lookup user auth_id', userErr);
          throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        authId = userRow?.auth_id;
        if (!authId) {
          console.error('[cv-submissions] user missing auth_id for id', user?.sub);
          throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
      }

      await this.svc.upsertCv(authId, payload);
      return { ok: true };
    } catch (err: any) {
      console.error('[cv-submissions] create error:', err?.message ?? err, err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
