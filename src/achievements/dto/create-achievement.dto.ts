import { IsString } from 'class-validator';

export class CreateAchievementDto {
  @IsString()
  readonly key: string;

  @IsString()
  readonly name: string;

  @IsString()
  readonly description: string;

  @IsString()
  readonly icon: string;
}
