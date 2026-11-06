import {
  Allow,
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @Allow()
  dueAt?: string | null;

  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  reminderFireTimes?: string[];

  @IsOptional()
  @IsIn(['open', 'done', 'cancelled'])
  status?: 'open' | 'done' | 'cancelled';
}
