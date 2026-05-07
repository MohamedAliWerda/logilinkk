import { Module } from '@nestjs/common';
import { OffresService } from './offres.service';
import { OffresController } from './offres.controller';
import { CvSubmissionModule } from '../cv_submission/cv-submission.module';

@Module({
  imports: [CvSubmissionModule],
  controllers: [OffresController],
  providers: [OffresService],
  exports: [OffresService],
})
export class OffresModule {}
