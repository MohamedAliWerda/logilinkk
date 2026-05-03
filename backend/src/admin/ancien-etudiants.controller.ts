import { Controller, Get } from '@nestjs/common';
import { Body, Post } from '@nestjs/common';
import { AncienEtudiantsService } from './ancien-etudiants.service';

@Controller('admin')
export class AncienEtudiantsController {
  constructor(private readonly service: AncienEtudiantsService) {}

  @Get()
  async findAll() {
    return this.service.fetchAll();
  }

  @Get('ancien-etudiants')
  async findAncienEtudiants() {
    return this.service.fetchAll();
  }

  @Get('feedback')
  async findFeedback() {
    return this.service.fetchTable('feedback');
  }

  @Post('ancien-etudiants')
  async createAncienEtudiant(@Body() body: Record<string, unknown>) {
    return this.service.createAncienEtudiant(body);
  }

  @Post('feedback')
  async createFeedback(@Body() body: Record<string, unknown>) {
    return this.service.createFeedback(body);
  }
}
