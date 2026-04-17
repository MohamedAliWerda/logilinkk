import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminRecommendationsController } from './admin-recommendations.controller';
import { AdminRecommendationsService } from './admin-recommendations.service';

@Module({
  imports: [ConfigModule],
  controllers: [AdminRecommendationsController],
  providers: [AdminRecommendationsService],
})
export class AdminRecommendationsModule {}
