import { BadRequestException } from '@nestjs/common';

/** Все поддерживаемые валюты имеют две дробные цифры. */
const MINOR_UNITS_PER_MAJOR = 100;

/**
 * Перевод суммы из API (рубли, доллары) в целые копейки, в которых хранятся
 * деньги. Округление снимает двоичный шум float: 19.99 * 100 = 1998.9999….
 */
export function toMinor(major: number): number {
  const minor = Math.round(major * MINOR_UNITS_PER_MAJOR);
  if (!Number.isSafeInteger(minor)) {
    throw new BadRequestException('Amount is out of range');
  }
  return minor;
}

export function toMajor(minor: number): number {
  return minor / MINOR_UNITS_PER_MAJOR;
}

/** Как сумма транзакции отразилась на кошельке. */
export const WALLET_EFFECTS = ['debit', 'credit'] as const;
export type WalletEffect = (typeof WALLET_EFFECTS)[number];

export const signedWalletDelta = (effect: WalletEffect, amountMinor: number) =>
  effect === 'credit' ? amountMinor : -amountMinor;
