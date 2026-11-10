import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { moneyVirtual, SERIALIZE_MONEY } from '../../common/money.virtual';
import { WALLET_EFFECTS, type WalletEffect } from '../../common/money';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true, ...SERIALIZE_MONEY })
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Goal' })
  goal?: Types.ObjectId;

  /** Сумма в копейках, целое число. */
  @Prop({ required: true, validate: Number.isInteger })
  amountMinor!: number;

  /** Основные единицы, виртуальное поле поверх amountMinor. */
  amount!: number;

  /** Валюта пользователя в момент операции. */
  @Prop({ required: true })
  currency!: string;

  /** Как операция изменила кошелёк; без этого поля кошелёк не затронут. */
  @Prop({ type: String, enum: [...WALLET_EFFECTS] })
  walletEffect?: WalletEffect;

  @Prop({ required: true, enum: ['deposit', 'withdraw', 'income', 'expense'] })
  type!: string;

  @Prop({ required: true })
  category!: string;

  @Prop()
  description?: string;

  @Prop({ required: true })
  date!: Date;

  createdAt!: Date;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

TransactionSchema.index({ user: 1, date: -1 });
moneyVirtual(TransactionSchema, 'amount', 'amountMinor');
