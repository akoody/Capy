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
import { CurrentUserId } from '../auth/current-account';

@Controller('transaction-categories')
export class TransactionCategoriesController {
  constructor(
    private readonly categoriesService: TransactionCategoriesService,
  ) {}

  @Get()
  async list(@CurrentUserId() userId: string) {
    return this.categoriesService.findAllForUser(userId);
  }

  @Post()
  async create(
    @CurrentUserId() userId: string,
    @Body() dto: CreateTransactionCategoryDto,
  ) {
    return this.categoriesService.create(userId, dto);
  }

  @Patch(':id')
  async update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionCategoryDto,
  ) {
    return this.categoriesService.update(userId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    await this.categoriesService.remove(userId, id);
    return { ok: true };
  }
}
