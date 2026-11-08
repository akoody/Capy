import {
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class PiggyBankAmountDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  readonly amount!: number;

  /** Если указано, операция попадает в историю транзакций. */
  @IsString()
  @IsOptional()
  @MaxLength(100)
  readonly category?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  readonly description?: string;
}
