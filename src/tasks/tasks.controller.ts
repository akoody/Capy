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
import { TelegramUser } from '../user.decorator';
import { UsersService } from '../users/users.service';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly usersService: UsersService,
  ) {}

  private async userIdFromTelegram(telegramUser: { id: number }): Promise<string> {
    const user = await this.usersService.findOrCreateByTelegramUser(telegramUser);
    return user._id.toString();
  }

  @Get()
  async list(
    @TelegramUser() telegramUser: { id: number },
    @Query('status') status?: 'open' | 'done' | 'cancelled' | 'all',
  ) {
    const userId = await this.userIdFromTelegram(telegramUser);
    const st = status ?? 'all';
    const allowed = ['open', 'done', 'cancelled', 'all'] as const;
    const safe = allowed.includes(st as (typeof allowed)[number])
      ? st
      : 'all';
    return this.tasksService.findAllForUser(userId, safe);
  }

  @Post()
  async create(
    @TelegramUser() telegramUser: { id: number },
    @Body() dto: CreateTaskDto,
  ) {
    const userId = await this.userIdFromTelegram(telegramUser);
    return this.tasksService.create(userId, dto);
  }

  @Patch(':id')
  async update(
    @TelegramUser() telegramUser: { id: number },
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const userId = await this.userIdFromTelegram(telegramUser);
    return this.tasksService.update(userId, id, dto);
  }

  @Post(':id/complete')
  async complete(
    @TelegramUser() telegramUser: { id: number },
    @Param('id') id: string,
  ) {
    const userId = await this.userIdFromTelegram(telegramUser);
    return this.tasksService.complete(userId, id);
  }

  @Delete(':id')
  async remove(
    @TelegramUser() telegramUser: { id: number },
    @Param('id') id: string,
  ) {
    const userId = await this.userIdFromTelegram(telegramUser);
    await this.tasksService.remove(userId, id);
    return { ok: true };
  }
}
