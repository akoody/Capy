import { IsNumber } from 'class-validator';

export class UpdateGoalAmountDto {
  @IsNumber()
  readonly amount: number;
}
