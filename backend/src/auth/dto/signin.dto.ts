import { IsString, MinLength } from 'class-validator';

export class SignInDto {
  @IsString()
  @MinLength(4)
  cin_passport!: string;

  @IsString()
  @MinLength(1)
  mot_de_passe!: string;
}
