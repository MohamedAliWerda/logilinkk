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
}
