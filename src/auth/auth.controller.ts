import { Controller, Post, Get } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TelegramUser } from '../user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('login')
  async login(@TelegramUser() telegramUser: any) {
    return this.usersService.findOrCreateByTelegramUser(telegramUser);
  }
}
