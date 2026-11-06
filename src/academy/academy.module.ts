import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Course, CourseSchema } from './schemas/course.schema';
import { Lesson, LessonSchema } from './schemas/lesson.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/users.module';
import { AcademyController } from './academy.controller';
import { AcademyService } from './academy.service';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
    UsersModule,
    CacheModule.register(),
  ],
  controllers: [AcademyController],
  providers: [AcademyService],
})
export class AcademyModule {}
