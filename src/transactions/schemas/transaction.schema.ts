import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Goal' })
  goal?: Types.ObjectId;

  @Prop({ required: true })
  amount!: number;

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
