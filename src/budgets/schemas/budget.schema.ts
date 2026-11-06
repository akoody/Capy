import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type BudgetDocument = HydratedDocument<Budget>;

@Schema({ timestamps: true })
export class Budget {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true, enum: ['weekly', 'monthly'] })
  period: 'weekly' | 'monthly';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;
}

export const BudgetSchema = SchemaFactory.createForClass(Budget);
