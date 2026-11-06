import { IsString, IsOptional, IsDateString, IsArray } from 'class-validator';

export class CreateJournalEntryDto {
  @IsString()
  readonly content!: string;

  @IsString()
  @IsOptional()
  readonly title?: string;

  @IsArray()
  @IsOptional()
  readonly tags?: string[];

  @IsDateString()
  @IsOptional()
  readonly date?: string;
}
