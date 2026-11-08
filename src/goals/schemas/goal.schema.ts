import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { moneyVirtual, SERIALIZE_MONEY } from '../../common/money.virtual';

export type GoalDocument = HydratedDocument<Goal>;

@Schema({ _id: false, ...SERIALIZE_MONEY })
class RecurringTransaction {
  @Prop({ validate: Number.isInteger })
  amountMinor!: number;

  amount!: number;

  @Prop()
  frequency!: 'daily' | 'weekly' | 'monthly';

  @Prop()
  startDate!: Date;
}

const RecurringTransactionSchema =
  SchemaFactory.createForClass(RecurringTransaction);
moneyVirtual(RecurringTransactionSchema, 'amount', 'amountMinor');

@Schema({ timestamps: true, ...SERIALIZE_MONEY })
export class Goal {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true, validate: Number.isInteger })
  targetAmountMinor!: number;

  targetAmount!: number;

  @Prop({ default: 0, min: 0, validate: Number.isInteger })
  currentAmountMinor!: number;

  currentAmount!: number;

  @Prop()
  targetDate!: Date;

  @Prop()
  icon!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: RecurringTransactionSchema })
  recurringTransaction?: RecurringTransaction;

  @Prop()
  notes?: string;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);

GoalSchema.index({ user: 1 });
moneyVirtual(GoalSchema, 'targetAmount', 'targetAmountMinor');
moneyVirtual(GoalSchema, 'currentAmount', 'currentAmountMinor');
