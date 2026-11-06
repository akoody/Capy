import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Task, TaskSchema } from './schemas/task.schema';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { TasksReminderScheduler } from './tasks-reminder.scheduler';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Task.name, schema: TaskSchema }]),
    UsersModule,
    TelegramModule,
  ],
  controllers: [TasksController],
  providers: [TasksService, TasksReminderScheduler],
  exports: [TasksService],
})
export class TasksModule {}
