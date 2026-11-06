import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-account';
import { PiggyBankAmountDto } from './dto/piggy-bank-amount.dto';
import { PiggyBankService } from './piggy-bank.service';

@Controller('piggy-bank')
export class PiggyBankController {
  constructor(private readonly piggyBankService: PiggyBankService) {}

  @Get()
  findOne(@CurrentUserId() userId: string) {
    return this.piggyBankService.findOneByUser(userId);
  }

  @Patch('deposit')
  deposit(@CurrentUserId() userId: string, @Body() dto: PiggyBankAmountDto) {
    return this.piggyBankService.deposit(userId, dto.amount);
  }

  @Patch('withdraw')
  withdraw(@CurrentUserId() userId: string, @Body() dto: PiggyBankAmountDto) {
    return this.piggyBankService.withdraw(userId, dto.amount);
  }

  @Post('analyze')
  async analyze(@CurrentUserId() userId: string) {
    const analysis = await this.piggyBankService.analyzeSavings(userId);
    return { analysis };
  }
}
