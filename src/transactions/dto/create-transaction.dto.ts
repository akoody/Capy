import {
  IsString,
  IsNumber,
  IsIn,
  IsOptional,
  IsDateString,
  IsMongoId,
  IsPositive,
} from 'class-validator';

export class CreateTransactionDto {
  @IsMongoId()
  @IsOptional()
  readonly goal?: string;

  @IsNumber()
  @IsPositive()
  readonly amount: number;

  @IsIn(['deposit', 'withdraw', 'income', 'expense'])
  readonly type: string;

  /** Текст категории (если нет categoryId). */
  @IsString()
  @IsOptional()
  readonly category?: string;

  /** Или выбор из справочника категорий. */
  @IsMongoId()
  @IsOptional()
  readonly categoryId?: string;

  @IsString()
  @IsOptional()
  readonly description?: string;

  @IsDateString()
  readonly date: string;
}
