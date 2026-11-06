import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-account';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionsService } from './transactions.service';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateTransactionDto) {
    return this.transactionsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.transactionsService.findAllForUser(userId);
  }

  @Put(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(userId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.transactionsService.remove(userId, id);
  }

  @Post('analyze')
  async analyze(@CurrentUserId() userId: string) {
    const analysis = await this.transactionsService.analyzeTransactions(userId);
    return { analysis };
  }
}
