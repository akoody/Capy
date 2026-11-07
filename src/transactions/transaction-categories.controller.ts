import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { TransactionCategoriesService } from './transaction-categories.service';
import { CreateTransactionCategoryDto } from './dto/create-transaction-category.dto';
import { UpdateTransactionCategoryDto } from './dto/update-transaction-category.dto';
import { TelegramUser } from '../auth/telegram-user.decorator';
import { UsersService } from '../users/users.service';
import type { TelegramUserPayload } from '../auth/telegram-init-data';

@Controller('transaction-categories')
export class TransactionCategoriesController {
  constructor(
    private readonly categoriesService: TransactionCategoriesService,
    private readonly usersService: UsersService,
  ) {}

  private async userId(telegramUser: TelegramUserPayload): Promise<string> {
    const user = await this.usersService.findOrCreateByTelegramUser(telegramUser);
    return user._id.toString();
  }

  @Get()
  async list(@TelegramUser() telegramUser: TelegramUserPayload) {
    const uid = await this.userId(telegramUser);
    return this.categoriesService.findAllForUser(uid);
  }

  @Post()
  async create(
    @TelegramUser() telegramUser: TelegramUserPayload,
    @Body() dto: CreateTransactionCategoryDto,
  ) {
    const uid = await this.userId(telegramUser);
    return this.categoriesService.create(uid, dto);
  }

  @Patch(':id')
  async update(
    @TelegramUser() telegramUser: TelegramUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionCategoryDto,
  ) {
    const uid = await this.userId(telegramUser);
    return this.categoriesService.update(uid, id, dto);
  }

  @Delete(':id')
  async remove(
    @TelegramUser() telegramUser: TelegramUserPayload,
    @Param('id') id: string,
  ) {
    const uid = await this.userId(telegramUser);
    await this.categoriesService.remove(uid, id);
    return { ok: true };
  }
}
