import { IsMongoId } from 'class-validator';

export class CompleteLessonDto {
  @IsMongoId()
  readonly lessonId: string;
}
