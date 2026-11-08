import { IsNumber, IsString, IsEnum, IsPositive } from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  name!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;

  @IsString()
  category!: string;

  @IsEnum(['weekly', 'monthly'])
  period!: 'weekly' | 'monthly';
}
