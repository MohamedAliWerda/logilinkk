import { Controller, Get, Req, UseGuards, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsSyncService } from './sync.service';
import { ScoreV2Service } from './score-v2.service';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class StudentRecommendationsController {
  constructor(
    private readonly svc: RecommendationsService,
    private readonly syncSvc: RecommendationsSyncService,
    private readonly scoreV2Service: ScoreV2Service,
  ) {}

  private resolveAuthId(reqUser: any): string | null {
    const id = reqUser?.sub ?? reqUser?.id ?? reqUser?.userId ?? null;
    if (!id) return null;
    return String(id).trim() || null;
  }

  @Get('approved')
  async listApproved(@Req() req: any) {
    const authId = this.resolveAuthId(req.user);
    if (!authId) {
      return { items: [] };
    }

    const items = await this.svc.listApprovedRecommendationsForStudent(authId);
    return { items };
  }

  @Post('sync-mongo')
  async triggerFullSync() {
    const res = await this.syncSvc.fullSyncAllStudents();
    return { ok: true, result: res };
  }

  @Get('score-v2')
  async getScoreV2(@Req() req: any) {
    const authId = this.resolveAuthId(req.user);
    if (!authId) {
      return { item: null };
    }

    const item = await this.scoreV2Service.getScoreForAuthId(authId);
    return { item };
  }

  @Post('score-v2/compute')
  async computeScoreV2(@Req() req: any) {
    const authId = this.resolveAuthId(req.user);
    if (!authId) {
      return { item: null };
    }

    const item = await this.scoreV2Service.computeAndStoreForAuthId(authId);
    return { item };
  }
}
