import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUserId } from '../auth/current-account';
import { CreateGoalDto } from './dto/create-goal.dto';
import { SetupRecurringTransactionDto } from './dto/setup-recurring-transaction.dto';
import { UpdateGoalAmountDto } from './dto/update-goal-amount.dto';
import { UpdateGoalNotesDto } from './dto/update-goal-notes.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateGoalDto) {
    return this.goalsService.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.goalsService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.goalsService.findOne(userId, id);
  }

  @Patch(':id/deposit')
  deposit(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalAmountDto,
  ) {
    return this.goalsService.deposit(userId, id, dto);
  }

  @Patch(':id/withdraw')
  withdraw(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalAmountDto,
  ) {
    return this.goalsService.withdraw(userId, id, dto);
  }

  @Patch(':id/recurring')
  setupRecurringTransaction(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: SetupRecurringTransactionDto,
  ) {
    return this.goalsService.setupRecurringTransaction(userId, id, dto);
  }

  @Patch(':id/restore')
  restore(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.goalsService.restore(userId, id);
  }

  @Patch(':id/notes')
  updateNotes(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateGoalNotesDto,
  ) {
    return this.goalsService.updateNotes(userId, id, dto.notes);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.goalsService.remove(userId, id);
  }

  @Delete(':id/recurring')
  removeRecurring(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.goalsService.removeRecurring(userId, id);
  }
}
