import { Controller, Get } from '@nestjs/common';
import { RefCompetanceService } from 'src/ref_competance/ref_competance.service';

@Controller('ref-competance')
export class RefCompetanceController {
  constructor(private readonly refCompetanceService: RefCompetanceService) {}

  @Get('competences')
  async getCompetences() {
    const data = await this.refCompetanceService.getReferentielCompetences();
    return {
      message: 'Referentiel competences fetched',
      data,
    };
  }
}
