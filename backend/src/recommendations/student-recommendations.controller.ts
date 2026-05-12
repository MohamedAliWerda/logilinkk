import { Controller, Get, Req, UseGuards, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsSyncService } from './sync.service';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class StudentRecommendationsController {
  constructor(
    private readonly svc: RecommendationsService,
    private readonly syncSvc: RecommendationsSyncService,
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
}
