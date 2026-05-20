import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OffresService } from './offres.service';
import { OffresController } from './offres.controller';
import { OffresScheduler } from './offres.scheduler';
import { OffresMigrationService } from './offres-migration.service';
import { CvSubmissionModule } from '../cv_submission/cv-submission.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [ScheduleModule.forRoot(), CvSubmissionModule, AdminModule],
  controllers: [OffresController],
  providers: [OffresService, OffresScheduler, OffresMigrationService],
  exports: [OffresService],
})
export class OffresModule {}
