import { Module } from '@nestjs/common';
import { AncienEtudiantsController } from './ancien-etudiants.controller';
import { AncienEtudiantsService } from './ancien-etudiants.service';

@Module({
  controllers: [AncienEtudiantsController],
  providers: [AncienEtudiantsService],
  exports: [AncienEtudiantsService],
})
export class AdminModule {}
