import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CertificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  provider!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  duration!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  pricing!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;
}

export class UpdateCertificationDto {
  @ValidateNested()
  @Type(() => CertificationDto)
  certification!: CertificationDto;
}
