import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ProfileModule } from './profile/profile.module';
import { RefCompetanceModule } from './ref_competance/ref_competance.module';
import { CvSubmissionModule } from './cv_submission/cv-submission.module';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    ProfileModule,
    RefCompetanceModule,
    CvSubmissionModule,
    RecommendationsModule,
  ],
})
export class AppModule {}
