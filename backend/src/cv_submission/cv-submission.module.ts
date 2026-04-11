import { Module } from '@nestjs/common';
import { CvSubmissionController } from './cv-submission.controller';
import { CvSubmissionService } from './cv-submission.service';
import { RefCompetanceModule } from '../ref_competance/ref_competance.module';

@Module({
  imports: [RefCompetanceModule],
  controllers: [CvSubmissionController],
  providers: [CvSubmissionService],
})
export class CvSubmissionModule {}
