import { Controller, Get, Post, Body, Param, Put, Delete, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TelegramUser } from '../auth/telegram-user.decorator';
import { UsersService } from '../users/users.service';
import type { TelegramUserPayload } from '../auth/telegram-init-data';

@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly usersService: UsersService,
  ) {}

  private async getUserIdFromTelegram(telegramUser: TelegramUserPayload): Promise<string> {
    const user = await this.usersService.findOrCreateByTelegramUser(telegramUser);
    return user._id.toString();
  }

  @Post()
  create(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionsService.create(createTransactionDto);
  }

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.transactionsService.findAllForUser(userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateTransactionDto: UpdateTransactionDto) {
    return this.transactionsService.update(id, updateTransactionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.transactionsService.remove(id);
  }

  @Post('analyze')
  async analyze(@TelegramUser() telegramUser: TelegramUserPayload) {
    const userId = await this.getUserIdFromTelegram(telegramUser);
    const analysis = await this.transactionsService.analyzeTransactions(userId);
    return { analysis };
  }
}
