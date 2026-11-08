import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { moneyVirtual, SERIALIZE_MONEY } from '../../common/money.virtual';

export type PiggyBankDocument = HydratedDocument<PiggyBank>;

@Schema({ timestamps: true, ...SERIALIZE_MONEY })
export class PiggyBank {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  user!: Types.ObjectId;

  /** Баланс в копейках, целое число. */
  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  amountMinor!: number;

  amount!: number;
}

export const PiggyBankSchema = SchemaFactory.createForClass(PiggyBank);

moneyVirtual(PiggyBankSchema, 'amount', 'amountMinor');
