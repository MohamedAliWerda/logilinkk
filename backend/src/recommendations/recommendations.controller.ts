import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RecommendationsService } from './recommendations.service';

@Controller('admin/recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  private resolveAdminAuthId(reqUser: any): string | null {
    const id = reqUser?.sub ?? reqUser?.id ?? reqUser?.userId ?? null;
    if (!id) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
    return isUuid ? String(id) : null;
  }

  @Post('generate')
  async generate(@Req() req: any) {
    try {
      const adminAuthId = this.resolveAdminAuthId(req.user);
      return await this.svc.triggerGeneration(adminAuthId);
    } catch (err: any) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(err?.message ?? 'generation failed', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('jobs')
  async listJobs(@Query('limit') limit?: string) {
    const parsed = Number(limit ?? '20');
    const safe = Number.isFinite(parsed) ? Math.max(1, Math.min(100, Math.floor(parsed))) : 20;
    return { jobs: await this.svc.listJobs(safe) };
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    return this.svc.getJob(id);
  }

  @Get()
  async list(@Query('status') status?: string) {
    const items = await this.svc.listRecommendations(status && status.trim() ? status.trim() : undefined);
    return { items };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.svc.getRecommendation(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() patch: any) {
    return this.svc.updateRecommendation(id, patch ?? {});
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    const adminAuthId = this.resolveAdminAuthId(req.user);
    return this.svc.approveRecommendation(id, adminAuthId, body?.comment);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    const adminAuthId = this.resolveAdminAuthId(req.user);
    await this.svc.rejectRecommendation(id, adminAuthId, body?.comment);
    return { ok: true };
  }
}
