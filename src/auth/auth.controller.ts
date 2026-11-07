import { Controller, Post } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TelegramUser } from './telegram-user.decorator';
import type { TelegramUserPayload } from './telegram-init-data';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  async login(@TelegramUser() telegramUser: TelegramUserPayload) {
    return this.usersService.findOrCreateByTelegramUser(telegramUser);
  }
}
