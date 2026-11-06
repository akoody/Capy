import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AcademyService } from './academy.service';
import { CurrentUserId } from '../auth/current-account';
import { CompleteLessonDto } from './dto/complete-lesson.dto';

@Controller('academy')
export class AcademyController {
  constructor(private readonly academyService: AcademyService) {}

  @Get('courses')
  findAllCourses() {
    return this.academyService.findAllCourses();
  }

  @Get('courses/:id')
  findCourse(@Param('id') id: string) {
    return this.academyService.findCourse(id);
  }

  @Post('lessons/complete')
  completeLesson(
    @CurrentUserId() userId: string,
    @Body() dto: CompleteLessonDto,
  ) {
    return this.academyService.completeLesson(userId, dto.lessonId);
  }
}
