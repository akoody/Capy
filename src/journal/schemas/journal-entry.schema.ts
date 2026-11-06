import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type JournalEntryDocument = HydratedDocument<JournalEntry>;

@Schema({ timestamps: true })
export class JournalEntry {
  @Prop({ required: true })
  content!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop()
  title?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: Date.now })
  date!: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const JournalEntrySchema = SchemaFactory.createForClass(JournalEntry);
