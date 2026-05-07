import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { OffresService } from './offres.service';

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

  @Put(':id')
  async updateOffre(@Param('id') id: string, @Body() data: any) {
    return await this.offresService.updateOffre(id, data);
  }

  @Delete(':id')
  async deleteOffre(@Param('id') id: string) {
    return await this.offresService.deleteOffre(id);
  }
}
