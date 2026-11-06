import { Controller, Get, Post, Body, Query, Patch } from '@nestjs/common';
import { PiggyBankService } from './piggy-bank.service';
import { TelegramUser } from '../auth/telegram-user.decorator';
import { UsersService } from '../users/users.service';
import type { TelegramUserPayload } from '../auth/telegram-init-data';

@Controller('piggy-bank')
export class PiggyBankController {
  constructor(
    private readonly piggyBankService: PiggyBankService,
    private readonly usersService: UsersService,
  ) {}

  private async getUserIdFromTelegram(telegramUser: TelegramUserPayload): Promise<string> {
    const user = await this.usersService.findOrCreateByTelegramUser(telegramUser);
    return user._id.toString();
  }

  @Get()
  findOne(@Query('userId') userId: string) {
    return this.piggyBankService.findOneByUser(userId);
  }

  @Patch('deposit')
  deposit(@Body() body: { userId: string, amount: number }) {
    return this.piggyBankService.deposit(body.userId, body.amount);
  }

  @Patch('withdraw')
  withdraw(@Body() body: { userId: string, amount: number }) {
    return this.piggyBankService.withdraw(body.userId, body.amount);
  }

  @Post('analyze')
  async analyze(@TelegramUser() telegramUser: TelegramUserPayload) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    const analysis = await this.piggyBankService.analyzeSavings(userId);
    return { analysis };
  }
}
