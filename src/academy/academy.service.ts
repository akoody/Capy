import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { User } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class AcademyService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
    @InjectModel(Lesson.name) private lessonModel: Model<LessonDocument>,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAllCourses(): Promise<Course[]> {
    return this.cacheManager.wrap('all_courses', () => {
      return this.courseModel.find().populate('lessons').exec();
    });
  }

  async findCourse(id: string): Promise<Course | null> {
    return this.cacheManager.wrap(`course_${id}`, () => {
      return this.courseModel.findById(id).populate('lessons').exec();
    });
  }

  async completeLesson(userId: string, lessonId: string): Promise<User | null> {
    const lesson = await this.lessonModel.findById(lessonId);
    if (!lesson) {
      throw new Error('Lesson not found');
    }

    let user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.completedLessons.map((id) => id.toString()).includes(lessonId)) {
      return user; // Lesson already completed
    }

    user = await this.usersService.completeLesson(userId, lessonId);
    if (!user) return null;
    user = await this.usersService.addPoints(userId, 10);

    const course = await this.courseModel.findOne({ lessons: lessonId });
    if (course && user) {
      const completedLessonsInCourse = user.completedLessons.filter(
        (completedLessonId) =>
          course.lessons
            .map((l) => l.toString())
            .includes(completedLessonId.toString()),
      );

      if (completedLessonsInCourse.length === course.lessons.length) {
        if (
          user.completedCourses &&
          !user.completedCourses
            .map((id) => id.toString())
            .includes(course._id.toString())
        ) {
          user = await this.usersService.addCompletedCourse(
            userId,
            course._id.toString(),
          );
          if (user) {
            user = await this.usersService.addBadge(
              userId,
              `${course.category} Graduate`,
            );
          }
          if (user) {
            user = await this.usersService.addPoints(userId, 50);
          }
        }
      }
    }

    // Invalidate cache for user-related data if necessary
    await this.cacheManager.del(`user_${userId}`);

    return user;
  }
}
