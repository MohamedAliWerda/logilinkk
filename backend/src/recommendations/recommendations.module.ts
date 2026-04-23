import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RecommendationsController } from './recommendations.controller';
import { StudentRecommendationsController } from './student-recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [ConfigModule],
  controllers: [RecommendationsController, StudentRecommendationsController],
  providers: [RecommendationsService],
})
export class RecommendationsModule {}
