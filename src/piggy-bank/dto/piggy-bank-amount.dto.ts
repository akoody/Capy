import { IsNumber, IsPositive } from 'class-validator';

export class PiggyBankAmountDto {
  @IsNumber()
  @IsPositive()
  readonly amount!: number;
}
