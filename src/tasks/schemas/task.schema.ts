import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TaskDocument = HydratedDocument<Task>;

export interface TaskReminder {
  _id?: Types.ObjectId;
  fireAt: Date;
  /** Отправлено (или прекращены попытки, см. failedAt). */
  sentAt?: Date;
  /** Занято экземпляром воркера на время отправки. */
  claimedAt?: Date;
  attempts?: number;
  failedAt?: Date;
}

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
        claimedAt: { type: Date, required: false },
        attempts: { type: Number, default: 0 },
        failedAt: { type: Date, required: false },
      },
    ],
    default: [],
  })
  reminders!: TaskReminder[];

  @Prop()
  completedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

TaskSchema.index({ status: 1, 'reminders.fireAt': 1 });
TaskSchema.index({ user: 1, status: 1 });
