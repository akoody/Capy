import { IsIn, IsOptional } from 'class-validator';

export const SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'RUB',
  'MDL',
] as const;
export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;

/**
 * Поля профиля, которые пользователь меняет сам. Всё остальное (очки, бейджи,
 * друзья, telegramId) меняется только доменной логикой, не через этот DTO.
 */
export class UpdateProfileDto {
  @IsOptional()
  @IsIn(SUPPORTED_CURRENCIES)
  readonly currency?: (typeof SUPPORTED_CURRENCIES)[number];

  @IsOptional()
  @IsIn(SUPPORTED_LANGUAGES)
  readonly language?: (typeof SUPPORTED_LANGUAGES)[number];
}
