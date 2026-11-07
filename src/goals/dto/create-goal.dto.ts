import {
  IsString,
  IsNumber,
  IsDate,
  IsPositive,
  IsOptional,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  readonly name!: string;

  @IsNumber()
  @IsPositive()
  readonly targetAmount!: number;

  @IsDate()
  @IsOptional()
  readonly targetDate?: Date;

  @IsString()
  @IsOptional()
  readonly icon?: string;
}
