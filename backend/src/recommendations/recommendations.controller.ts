import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GenerateRecommendationsDto } from './dto/generate-recommendations.dto';
import {
  RECOMMENDATION_STATUSES,
  RecommendationStatus,
  UpdateRecommendationDto,
} from './dto/update-recommendation.dto';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
@UseGuards(JwtAuthGuard)
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  private assertAdmin(user: any): void {
    const role = String(user?.role ?? '').trim().toLowerCase();
    if (role !== 'admin') {
      throw new ForbiddenException('Admin role required');
    }
  }

  private resolveActor(user: any): string {
    return String(user?.sub ?? user?.id ?? '').trim();
  }

  @Post('generate')
  async generate(@Req() req: any, @Body() dto: GenerateRecommendationsDto) {
    this.assertAdmin(req.user);
    const actor = this.resolveActor(req.user);
    const result = await this.recommendationsService.generateAndPersist(dto, actor);

    return {
      message: 'Recommendations generated',
      data: result,
    };
  }

  @Get()
  async list(@Req() req: any, @Query('status') status?: string) {
    this.assertAdmin(req.user);

    let normalizedStatus: RecommendationStatus | undefined;
    const statusValue = String(status ?? '').trim().toLowerCase();
    if (statusValue) {
      if (!RECOMMENDATION_STATUSES.includes(statusValue as RecommendationStatus)) {
        throw new BadRequestException(`Unsupported status: ${statusValue}`);
      }
      normalizedStatus = statusValue as RecommendationStatus;
    }

    const rows = await this.recommendationsService.list(normalizedStatus);
    return {
      message: 'Recommendations loaded',
      data: rows,
    };
  }

  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRecommendationDto,
  ) {
    this.assertAdmin(req.user);
    const actor = this.resolveActor(req.user);
    const row = await this.recommendationsService.update(id, dto, actor);
    return {
      message: 'Recommendation updated',
      data: row,
    };
  }

  @Delete(':id')
  async remove(
    @Req() req: any,
    @Param('id') id: string,
    @Query('hard', new ParseBoolPipe({ optional: true })) hard?: boolean,
  ) {
    this.assertAdmin(req.user);
    const actor = this.resolveActor(req.user);
    const result = await this.recommendationsService.remove(id, Boolean(hard), actor);
    return {
      message: hard ? 'Recommendation permanently deleted' : 'Recommendation marked deleted',
      data: result,
    };
  }
}
