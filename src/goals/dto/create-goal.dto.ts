import {
  IsString,
  IsNumber,
  IsDate,
  IsMongoId,
  IsOptional,
} from 'class-validator';

export class CreateGoalDto {
  @IsString()
  readonly name: string;

  @IsNumber()
  readonly targetAmount: number;

  @IsDate()
  @IsOptional()
  readonly targetDate?: Date;

  @IsMongoId()
  readonly userId: string;

  @IsString()
  @IsOptional()
  readonly icon?: string;
}
