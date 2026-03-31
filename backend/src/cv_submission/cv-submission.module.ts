import { Module } from '@nestjs/common';
import { CvSubmissionController } from './cv-submission.controller';
import { CvSubmissionService } from './cv-submission.service';

@Module({
  controllers: [CvSubmissionController],
  providers: [CvSubmissionService],
})
export class CvSubmissionModule {}
