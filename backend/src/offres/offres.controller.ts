import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { OffresService } from './offres.service';

type ApplyRequestBody = {
  id_etudiant: number | string;
  applications: Array<{
    id_post: number | string;
    id_societe?: number | string;
  }>;
};

@Controller('offres')
export class OffresController {
  constructor(private offresService: OffresService) {}

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
