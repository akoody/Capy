import { IsString, MaxLength } from 'class-validator';

export class UpdateGoalNotesDto {
  @IsString()
  @MaxLength(5000)
  readonly notes: string;
}
