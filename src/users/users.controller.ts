import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  NotFoundException,
  Res,
  Patch,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import type { Response } from 'express';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id/friends')
  getFriends(@Param('id') id: string) {
    return this.usersService.getFriends(id);
  }

  @Get(':id/export')
  async exportData(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.usersService.exportData(id);
    res.header('Content-Type', 'text/csv');
    res.attachment('capy-export.csv');
    return res.send(csv);
  }

  @Get('id/:id')
  async findById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  @Get(':telegramId')
  async findOne(@Param('telegramId') telegramId: string) {
    const user = await this.usersService.findOneByTelegramId(+telegramId);
    if (!user) {
      throw new NotFoundException(
        `User with telegramId ${telegramId} not found`,
      );
    }
    return user;
  }

  @Get(':id/streak')
  getStreak(@Param('id') id: string) {
    return this.usersService.getSavingStreak(id);
  }

  @Post(':userId/lessons/:lessonId/complete')
  completeLesson(
    @Param('userId') userId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.usersService.completeLesson(userId, lessonId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.usersService.update(id, updateData);
  }
}
