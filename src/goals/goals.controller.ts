import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
} from '@nestjs/common';
import { GoalsService } from './goals.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalAmountDto } from './dto/update-goal-amount.dto';
import { SetupRecurringTransactionDto } from './dto/setup-recurring-transaction.dto';

@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  create(@Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.create(createGoalDto);
  }

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.goalsService.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.goalsService.findOne(id);
  }

  @Patch(':id/deposit')
  deposit(
    @Param('id') id: string,
    @Body() updateGoalAmountDto: UpdateGoalAmountDto,
  ) {
    return this.goalsService.deposit(id, updateGoalAmountDto);
  }

  @Patch(':id/withdraw')
  withdraw(
    @Param('id') id: string,
    @Body() updateGoalAmountDto: UpdateGoalAmountDto,
  ) {
    return this.goalsService.withdraw(id, updateGoalAmountDto);
  }

  @Patch(':id/recurring')
  setupRecurringTransaction(
    @Param('id') id: string,
    @Body() setupRecurringTransactionDto: SetupRecurringTransactionDto,
  ) {
    return this.goalsService.setupRecurringTransaction(
      id,
      setupRecurringTransactionDto,
    );
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.goalsService.restore(id);
  }

  @Patch(':id/notes')
  updateNotes(@Param('id') id: string, @Body() body: { notes: string }) {
    return this.goalsService.updateNotes(id, body.notes);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.goalsService.remove(id);
  }

  @Delete(':id/recurring')
  removeRecurring(@Param('id') id: string) {
    return this.goalsService.removeRecurring(id);
  }
}
