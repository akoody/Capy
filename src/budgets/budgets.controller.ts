import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-account';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';

@Controller('budgets')
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateBudgetDto) {
    return this.budgetsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.budgetsService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.budgetsService.findOne(userId, id);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.budgetsService.remove(userId, id);
  }
}
