import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type PiggyBankDocument = HydratedDocument<PiggyBank>;

@Schema({ timestamps: true })
export class PiggyBank {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  user!: Types.ObjectId;

  @Prop({ default: 0 })
  amount!: number;
}

export const PiggyBankSchema = SchemaFactory.createForClass(PiggyBank);
