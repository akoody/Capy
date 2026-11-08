import type { Schema } from 'mongoose';
import { toMajor, toMinor } from './money';

/**
 * Поле в основных единицах поверх хранимого поля в копейках: API и код
 * чтения работают с `amount`, база — с целым `amountMinor`.
 */
export function moneyVirtual(
  schema: Schema,
  majorField: string,
  minorField: string,
): void {
  schema
    .virtual(majorField)
    .get(function (this: Record<string, number | undefined>) {
      const minor = this[minorField];
      return typeof minor === 'number' ? toMajor(minor) : undefined;
    })
    .set(function (this: Record<string, number>, major: number) {
      this[minorField] = toMinor(major);
    });
}

/** Виртуальные поля попадают в JSON, служебный `id` — нет. */
export const SERIALIZE_MONEY = {
  id: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
} as const;
