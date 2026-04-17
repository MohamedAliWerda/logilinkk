import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { AdminRecommendationsService } from './admin-recommendations.service';
import { UpdateCertificationDto } from './dto/update-certification.dto';

@Controller('admin/recommendations')
export class AdminRecommendationsController {
  constructor(
    private readonly adminRecommendationsService: AdminRecommendationsService,
  ) {}

  @Get('ai-certifications')
  async getAiRecommendations() {
    const data = await this.adminRecommendationsService.getAiCertifications();
    return {
      message: 'AI recommendations loaded',
      data,
    };
  }

  @Post('ai-certifications/generate')
  async generateAiRecommendations() {
    const data = await this.adminRecommendationsService.generateAiCertifications();
    return {
      message: 'AI recommendations generated',
      data,
    };
  }

  @Put('ai-certifications/:id')
  async updateCertification(
    @Param('id') id: string,
    @Body() body: UpdateCertificationDto,
  ) {
    await this.adminRecommendationsService.updateCertification(
      id,
      body.certification,
    );

    return {
      message: 'Recommendation certification updated',
      data: { id },
    };
  }

  @Post('ai-certifications/:id/confirm')
  async confirmRecommendation(@Param('id') id: string) {
    await this.adminRecommendationsService.confirmRecommendation(id);

    return {
      message: 'Recommendation confirmed',
      data: { id },
    };
  }

  @Delete('ai-certifications/:id')
  async deleteRecommendation(@Param('id') id: string) {
    await this.adminRecommendationsService.deleteRecommendation(id);

    return {
      message: 'Recommendation deleted',
      data: { id },
    };
  }

  @Get('students/:authId/confirmed')
  async getConfirmedStudentRecommendations(@Param('authId') authId: string) {
    const data =
      await this.adminRecommendationsService.getConfirmedRecommendationsForStudent(
        authId,
      );

    return {
      message: 'Student confirmed recommendations loaded',
      data,
    };
  }
}
