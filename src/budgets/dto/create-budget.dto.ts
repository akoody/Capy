import { IsNumber, IsString, IsEnum } from 'class-validator';

export class CreateBudgetDto {
  @IsString()
  name: string;

  @IsNumber()
  amount: number;

  @IsString()
  category: string;

  @IsEnum(['weekly', 'monthly'])
  period: 'weekly' | 'monthly';

  @IsString()
  userId: string;
}
