import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AchievementDocument = HydratedDocument<Achievement>;

@Schema()
export class Achievement {
  @Prop({ required: true, unique: true })
  key: string; // e.g., 'FIRST_GOAL'

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  icon: string; // Emoji or icon name
}

export const AchievementSchema = SchemaFactory.createForClass(Achievement);
