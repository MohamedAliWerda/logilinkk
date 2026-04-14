import { Body, Controller, Get, HttpException, HttpStatus, Post, UseGuards, Req, Query } from '@nestjs/common';
import { CvSubmissionService } from './cv-submission.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { getSupabase } from '../config/supabase.client';

@Controller('cv-submissions')
export class CvSubmissionController {
  constructor(private readonly svc: CvSubmissionService) {}

  private isTransientNetworkError(err: any): boolean {
    const text = `${err?.message ?? ''} ${err?.details ?? ''} ${err?.code ?? ''}`.toLowerCase();
    return [
      'fetch failed',
      'etimedout',
      'econnreset',
      'enotfound',
      'eai_again',
      'socket hang up',
      'network',
    ].some((token) => text.includes(token));
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async withRetry<T>(operation: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (err: any) {
        lastError = err;
        if (!this.isTransientNetworkError(err) || attempt === maxAttempts) {
          throw err;
        }
        const waitMs = 400 * attempt;
        console.warn(
          `[cv-submissions] transient network error (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms...`,
        );
        await this.wait(waitMs);
      }
    }
    throw lastError;
  }

  private parseBooleanFlag(value: unknown): boolean {
    if (value === true || value === 1 || value === '1') return true;
    if (value === false || value === 0 || value === '0') return false;

    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'true' || normalized === 'yes' || normalized === 'oui';
  }

  private async resolveAuthId(reqUser: any): Promise<string> {
    let authId = reqUser?.sub || reqUser?.id || reqUser?.userId;
    if (!authId) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const isUuid = (val?: string) => !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
    if (isUuid(authId)) {
      return authId;
    }

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
      console.error('[cv-submissions] user missing auth_id for id', reqUser?.sub ?? reqUser?.id);
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    return authId;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Req() req: any, @Body() payload: any) {
    try {
      const authId = await this.resolveAuthId(req.user);

      await this.withRetry(() => this.svc.upsertCv(authId, payload));
      return { ok: true };
    } catch (err: any) {
      console.error('[cv-submissions] create error:', err?.message ?? err, err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('ats-score')
  @UseGuards(JwtAuthGuard)
  async getMyAtsScore(@Req() req: any) {
    try {
      const authId = await this.resolveAuthId(req.user);
      const score = await this.svc.getAtsScoreByAuthId(authId);
      return { found: score !== null, atsScore: score };
    } catch (err: any) {
      console.error('[cv-submissions] getMyAtsScore error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('ats-score')
  async calculateAtsScore(@Req() req: any, @Body() payload: any) {
    try {
      const authId = await this.resolveAuthId(req.user);
      const result = await this.svc.calculateAtsScore(payload, authId);
      let employability: any = null;

      try {
        employability = await this.svc.runEmployabilityScoringForAuthId(authId);
      } catch (employabilityErr: any) {
        console.error('[cv-submissions] employability scoring failed:', employabilityErr?.message ?? employabilityErr);
        employability = {
          ok: false,
          error: String(employabilityErr?.message ?? 'Employability scoring failed'),
        };
      }

      try {
        await this.svc.updateAtsScore(authId, result.atsScore);
      } catch (persistErr: any) {
        const msg = String(persistErr?.message ?? persistErr ?? '');
        const isAuthFk = msg.includes('cv_submissions_auth_id_fkey') || String(persistErr?.code ?? '') === '23503';
        if (isAuthFk) {
          console.warn(
            '[cv-submissions] ATS score persistence skipped: auth_id from JWT is missing in user.auth_id (common with test/fake tokens).',
          );
        } else {
          console.error('[cv-submissions] ATS score persistence failed:', persistErr?.message ?? persistErr);
        }
      }
      return {
        ...result,
        employability,
      };
    } catch (err: any) {
      console.error('[cv-submissions] calculateAtsScore error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('matching-analysis')
  @UseGuards(JwtAuthGuard)
  async getMatchingAnalysis(@Req() req: any, @Query('force') force?: string) {
    try {
      const authId = await this.resolveAuthId(req.user);
      return await this.svc.getMatchingAnalysis(authId, this.parseBooleanFlag(force));
    } catch (err: any) {
      console.error('[cv-submissions] getMatchingAnalysis error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('matching-analysis')
  @UseGuards(JwtAuthGuard)
  async runMatchingAnalysis(@Req() req: any, @Body() payload?: any) {
    try {
      const authId = await this.resolveAuthId(req.user);
      const hasForce = payload && Object.prototype.hasOwnProperty.call(payload, 'force');
      const force = hasForce ? this.parseBooleanFlag(payload?.force) : true;
      return await this.svc.getMatchingAnalysis(authId, force);
    } catch (err: any) {
      console.error('[cv-submissions] runMatchingAnalysis error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('matching-analysis/trace')
  @UseGuards(JwtAuthGuard)
  async getMatchingAnalysisTrace(@Req() req: any, @Query('force') force?: string) {
    try {
      const authId = await this.resolveAuthId(req.user);
      return await this.svc.getMatchingAnalysisTrace(authId, this.parseBooleanFlag(force));
    } catch (err: any) {
      console.error('[cv-submissions] getMatchingAnalysisTrace error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('extract-skills')
  @UseGuards(JwtAuthGuard)
  async extractSkills(@Req() req: any, @Query('metierId') metierId?: string) {
    try {
      const authId = await this.resolveAuthId(req.user);
      const requestedMetierId = String(metierId ?? '').trim();
      if (!requestedMetierId) {
        return {
          found: false,
          hardSkills: [],
          softSkills: [],
        };
      }

      const skills = await this.withRetry(() => this.svc.extractSkillsFromNotes(authId, requestedMetierId));
      return {
        found: skills.hardSkills.length > 0 || skills.softSkills.length > 0,
        ...skills,
      };
    } catch (err: any) {
      console.error('[cv-submissions] extractSkills error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyCv(@Req() req: any, @Query('metierId') metierId?: string) {
    try {
      const authId = await this.resolveAuthId(req.user);
      const requestedMetierId = String(metierId ?? '').trim();

      const cv = await this.svc.getCvByAuthId(authId, requestedMetierId);
      if (!cv) {
        return { found: false };
      }
      return { found: true, cv };
    } catch (err: any) {
      console.error('[cv-submissions] getMyCv error:', err?.message ?? err);
      if (err instanceof HttpException) throw err;
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
