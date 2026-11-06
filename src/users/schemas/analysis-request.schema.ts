import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { User } from './user.schema';
import * as MongooseSchema from 'mongoose';

export type AnalysisRequestDocument = HydratedDocument<AnalysisRequest>;

@Schema({ timestamps: true })
export class AnalysisRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user: User;

  @Prop({ required: true, enum: ['transactions', 'savings', 'voice'] })
  type: 'transactions' | 'savings' | 'voice';

  @Prop({ required: true })
  timestamp: Date;
}

export const AnalysisRequestSchema =
  SchemaFactory.createForClass(AnalysisRequest);

// Index for efficient queries
AnalysisRequestSchema.index({ user: 1, timestamp: -1 });
