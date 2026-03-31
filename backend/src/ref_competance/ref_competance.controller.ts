import { Controller, Get, InternalServerErrorException, Logger } from '@nestjs/common';
import { RefCompetanceService } from 'src/ref_competance/ref_competance.service';

@Controller('ref-competance')
export class RefCompetanceController {
  private readonly logger = new Logger(RefCompetanceController.name);

  constructor(private readonly refCompetanceService: RefCompetanceService) {}

  @Get('competences')
  async getCompetences() {
    try {
      const data = await this.refCompetanceService.getReferentielCompetences();
      return {
        message: 'Referentiel competences fetched',
        data,
      };
    } catch (err) {
      this.logger.error('Failed to fetch referentiel competences', err as Error);
      throw new InternalServerErrorException('Failed to fetch referentiel competences');
    }
  }

  @Get('metiers')
  async getMetiers() {
    try {
      const data = await this.refCompetanceService.getMetiers();
      return {
        message: 'Metiers fetched',
        data,
      };
    } catch (err) {
      this.logger.error('Failed to fetch metiers', err as Error);
      throw new InternalServerErrorException('Failed to fetch metiers');
    }
  }

  @Get('domaines')
  async getDomaines() {
    try {
      const data = await this.refCompetanceService.getDomaines();
      return {
        message: 'Domaines fetched',
        data,
      };
    } catch (err) {
      this.logger.error('Failed to fetch domaines', err as Error);
      throw new InternalServerErrorException('Failed to fetch domaines');
    }
  }
}
