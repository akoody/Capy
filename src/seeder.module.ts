
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademySeeder } from './academy/seeder';
import { Course, CourseSchema } from './academy/schemas/course.schema';
import { Lesson, LessonSchema } from './academy/schemas/lesson.schema';
import { User, UserSchema } from './users/schemas/user.schema';
import { AcademyModule } from './academy/academy.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    MongooseModule.forFeature([
      { name: Course.name, schema: CourseSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AcademyModule,
  ],
  providers: [AcademySeeder],
})
export class SeederModule {}
