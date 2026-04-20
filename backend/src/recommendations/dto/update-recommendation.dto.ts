import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const RECOMMENDATION_STATUSES = ['pending', 'accepted', 'rejected', 'deleted'] as const;
export type RecommendationStatus = typeof RECOMMENDATION_STATUSES[number];

export class UpdateRecommendationDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  recommendedCertification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  recommendationText?: string;

  @IsOptional()
  @IsIn(RECOMMENDATION_STATUSES)
  status?: RecommendationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}
