import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export type PiggyBankDocument = HydratedDocument<PiggyBank>;

@Schema({ timestamps: true })
export class PiggyBank {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  })
  user!: User;

  @Prop({ default: 0 })
  amount!: number;
}

export const PiggyBankSchema = SchemaFactory.createForClass(PiggyBank);
