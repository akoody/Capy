import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CurrentUserId } from '../auth/current-account';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
  ) {}

  @Get()
  async list(
    @CurrentUserId() userId: string,
    @Query('status') status?: 'open' | 'done' | 'cancelled' | 'all',
  ) {
    const st = status ?? 'all';
    const allowed = ['open', 'done', 'cancelled', 'all'] as const;
    const safe = allowed.includes(st as (typeof allowed)[number])
      ? st
      : 'all';
    return this.tasksService.findAllForUser(userId, safe);
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(userId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(userId, id, dto);
  }

  @Post(':id/complete')
  async complete(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    return this.tasksService.complete(userId, id);
  }

  @Delete(':id')
  async remove(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
  ) {
    await this.tasksService.remove(userId, id);
    return { ok: true };
  }
}
