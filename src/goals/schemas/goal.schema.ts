import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GoalDocument = HydratedDocument<Goal>;

@Schema({ _id: false })
class RecurringTransaction {
  @Prop()
  amount!: number;

  @Prop()
  frequency!: 'daily' | 'weekly' | 'monthly';

  @Prop()
  startDate!: Date;
}

@Schema({ timestamps: true })
export class Goal {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  targetAmount!: number;

  @Prop({ default: 0 })
  currentAmount!: number;

  @Prop()
  targetDate!: Date;

  @Prop()
  icon!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: RecurringTransaction })
  recurringTransaction?: RecurringTransaction;

  @Prop()
  notes?: string;
}

export const GoalSchema = SchemaFactory.createForClass(Goal);
