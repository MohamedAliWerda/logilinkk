import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class StudentRecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

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
}
