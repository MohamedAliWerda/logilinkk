import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecommendationsController } from './recommendations.controller';
import { StudentRecommendationsController } from './student-recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationsSyncService } from './sync.service';

@Module({
  imports: [ConfigModule],
  controllers: [RecommendationsController, StudentRecommendationsController],
  providers: [RecommendationsService, RecommendationsSyncService],
})
export class RecommendationsModule {}
