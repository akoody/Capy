import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  /** ISO datetime — когда прислать напоминание в Telegram (можно несколько). */
  @IsOptional()
  @IsArray()
  @IsDateString({}, { each: true })
  reminderFireTimes?: string[];
}
