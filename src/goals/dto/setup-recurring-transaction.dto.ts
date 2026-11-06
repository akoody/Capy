import { IsNumber, IsString, IsDateString } from 'class-validator';

export class SetupRecurringTransactionDto {
  @IsNumber()
  amount!: number;

  @IsString()
  frequency!: 'daily' | 'weekly' | 'monthly';

  @IsDateString()
  startDate!: string;
}
