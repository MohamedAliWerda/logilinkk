import { Module } from '@nestjs/common';
import { RefCompetanceController } from './ref_competance.controller';
import { RefCompetanceService } from './ref_competance.service';

@Module({
  controllers: [RefCompetanceController],
  providers: [RefCompetanceService],
  exports: [RefCompetanceService],
})
export class RefCompetanceModule {}
