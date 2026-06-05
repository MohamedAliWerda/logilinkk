import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecommendationsController } from './recommendations.controller';
import { StudentRecommendationsController } from './student-recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsSyncService } from './sync.service';
import { ScoreV2Service } from './score-v2.service';

@Module({
  imports: [ConfigModule],
  controllers: [RecommendationsController, StudentRecommendationsController],
  providers: [RecommendationsService, RecommendationsSyncService, ScoreV2Service],
})
export class RecommendationsModule {}
