import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTransactionCategoryDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsIn(['expense', 'income', 'both'])
  kind!: 'expense' | 'income' | 'both';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
