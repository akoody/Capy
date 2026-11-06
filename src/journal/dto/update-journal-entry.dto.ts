import { IsString, IsOptional, IsDate, IsArray } from 'class-validator';

export class UpdateJournalEntryDto {
  @IsString()
  @IsOptional()
  readonly content?: string;

  @IsString()
  @IsOptional()
  readonly title?: string;

  @IsArray()
  @IsOptional()
  readonly tags?: string[];

  @IsDate()
  @IsOptional()
  readonly date?: Date;
}

