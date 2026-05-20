import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OffresService } from './offres.service';
import { OffresScheduler } from './offres.scheduler';

type ApplyRequestBody = {
  id_etudiant: number | string;
  applications: Array<{
    id_post: number | string;
    id_societe?: number | string;
  }>;
};

@Controller('offres')
export class OffresController {
  constructor(
    private offresService: OffresService,
    private offresScheduler: OffresScheduler,
  ) {}

  @Get('admin/trigger-feedback-reminders')
  async triggerFeedbackReminders() {
    const stats = await this.offresScheduler.sendFeedbackReminders();
    return { success: true, ...stats };
  }

  @Post('create')
  async createOffre(
    @Body()
    data: {
      titre_poste: string;
      societe: string;
      exigences: string;
      societe_id: string;
    },
  ) {
    return await this.offresService.createOffre(data);
  }

  @Get('active')
  async getActiveOffres() {
    return await this.offresService.getActiveOffres();
  }

  @Get('company/:societeId')
  async getOffresByCompany(@Param('societeId') societeId: string) {
    return await this.offresService.getOffresByCompany(societeId);
  }

  @Get('company/:societeId/candidatures')
  async getCompanyCandidatures(@Param('societeId') societeId: string) {
    return await this.offresService.getCompanyCandidatures(societeId);
  }

  @Get('company/:societeId/candidatures/:studentId/cv')
  async getCompanyCandidateCv(
    @Param('societeId') societeId: string,
    @Param('studentId') studentId: string,
    @Query('metierId') metierId?: string,
  ) {
    return await this.offresService.getCompanyCandidateCv(societeId, studentId, metierId);
  }

  @Get('student/:studentId/applied')
  async getStudentAppliedPostIds(@Param('studentId') studentId: string) {
    const id = Number(studentId);
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: 'studentId invalide', data: [] };
    }
    try {
      const ids = await this.offresService.getStudentAppliedPostIds(id);
      return { success: true, data: ids };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Erreur', data: [] };
    }
  }

  @Post('apply')
  async applyToOffres(@Body() data: ApplyRequestBody) {
    return await this.offresService.applyToOffres(data);
  }

  @Post('selection')
  async saveSelection(@Body() data: { id_etudiant: number | string; id_post: number | string; id_societe?: number | string }) {
    return await this.offresService.saveSelection(data);
  }

  @Post('selection/remove')
  async removeSelection(@Body() data: { id_etudiant: number | string; id_post: number | string; id_societe?: number | string }) {
    return await this.offresService.removeSelection(data);
  }

  @Put(':id')
  async updateOffre(@Param('id') id: string, @Body() data: any) {
    return await this.offresService.updateOffre(id, data);
  }

  @Delete(':id')
  async deleteOffre(@Param('id') id: string) {
    return await this.offresService.deleteOffre(id);
  }
}
