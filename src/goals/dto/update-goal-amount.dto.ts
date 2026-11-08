import { IsNumber, IsPositive } from 'class-validator';

export class UpdateGoalAmountDto {
  /** Только положительная сумма: направление задаёт маршрут deposit/withdraw. */
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  readonly amount!: number;
}
