import { Module } from '@nestjs/common';
import { RefCompetanceController } from 'src/ref_competance/ref_competance.controller';
import { RefCompetanceService } from 'src/ref_competance/ref_competance.service';

@Module({
  controllers: [RefCompetanceController],
  providers: [RefCompetanceService],
  exports: [RefCompetanceService],
})
export class RefCompetanceModule {}
