import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUserId } from '../auth/current-account';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

/** Профиль текущего пользователя. Чужие профили через этот контроллер не отдаются. */
@Controller('users/me')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async me(@CurrentUserId() userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch()
  async updateProfile(
    @CurrentUserId() userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.usersService.updateProfile(userId, dto);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Get('friends')
  friends(@CurrentUserId() userId: string) {
    return this.usersService.getFriends(userId);
  }

  @Get('streak')
  streak(@CurrentUserId() userId: string) {
    return this.usersService.getSavingStreak(userId);
  }

  @Get('export')
  async export(@CurrentUserId() userId: string, @Res() res: Response) {
    const csv = await this.usersService.exportData(userId);
    res.header('Content-Type', 'text/csv');
    res.attachment('capy-export.csv');
    return res.send(csv);
  }
}
