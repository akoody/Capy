import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type TransactionCategoryDocument = HydratedDocument<TransactionCategory>;

@Schema({ timestamps: true })
export class TransactionCategory {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true, trim: true })
  name: string;

  /** К каким операциям относится: расход, доход или оба варианта. */
  @Prop({
    required: true,
    enum: ['expense', 'income', 'both'],
    default: 'both',
  })
  kind: 'expense' | 'income' | 'both';

  /** Подсказка для голоса и ИИ: синонимы, что сюда относить. */
  @Prop({ trim: true })
  description?: string;

  @Prop({ default: false })
  archived: boolean;
}

export const TransactionCategorySchema =
  SchemaFactory.createForClass(TransactionCategory);

TransactionCategorySchema.index({ user: 1, name: 1 });
