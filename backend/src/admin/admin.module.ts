import { Module } from '@nestjs/common';
import { AncienEtudiantsController } from './ancien-etudiants.controller';
import { AncienEtudiantsService } from './ancien-etudiants.service';
import { GapsController } from './gaps.controller';
import { GapsService } from './gaps.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [AncienEtudiantsController, GapsController, DashboardController],
  providers: [AncienEtudiantsService, GapsService, DashboardService],
  exports: [AncienEtudiantsService, GapsService, DashboardService],
})
export class AdminModule {}
