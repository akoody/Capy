import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { moneyVirtual, SERIALIZE_MONEY } from '../../common/money.virtual';

export type BudgetDocument = HydratedDocument<Budget>;

@Schema({ timestamps: true, ...SERIALIZE_MONEY })
export class Budget {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, validate: Number.isInteger })
  amountMinor!: number;

  amount!: number;

  @Prop({ required: true })
  category!: string;

  @Prop({ required: true, enum: ['weekly', 'monthly'] })
  period!: 'weekly' | 'monthly';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);

BudgetSchema.index({ user: 1 });
moneyVirtual(BudgetSchema, 'amount', 'amountMinor');
