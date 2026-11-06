import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { AcademyService } from './academy.service';

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
  completeLesson(@Body() body: { userId: string; lessonId: string }) {
    return this.academyService.completeLesson(body.userId, body.lessonId);
  }
}
