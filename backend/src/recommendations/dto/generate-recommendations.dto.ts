import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GenerateRecommendationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  gapMinPct?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  maxItems?: number;

  @IsOptional()
  @IsString()
  ragCollection?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  useLlm?: boolean;
}
