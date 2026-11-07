import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

@Schema({ timestamps: true })
export class Task {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ enum: ['open', 'done', 'cancelled'], default: 'open' })
  status!: 'open' | 'done' | 'cancelled';

  @Prop({ enum: ['low', 'medium', 'high'], default: 'medium' })
  priority!: 'low' | 'medium' | 'high';

  @Prop()
  dueAt?: Date;

  @Prop({
    type: [
      {
        fireAt: { type: Date, required: true },
        sentAt: { type: Date, required: false },
      },
    ],
    default: [],
  })
  reminders!: { fireAt: Date; sentAt?: Date }[];

  @Prop()
  completedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);
