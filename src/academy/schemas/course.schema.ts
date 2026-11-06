import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema } from 'mongoose';
import { Lesson } from './lesson.schema';

export type CourseDocument = HydratedDocument<Course>;

@Schema({ timestamps: true })
export class Course {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ required: true, enum: ['Новичок', 'Средний', 'Продвинутый'] })
  category!: 'Новичок' | 'Средний' | 'Продвинутый';

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: Lesson.name }] })
  lessons!: Lesson[];
}

export const CourseSchema = SchemaFactory.createForClass(Course);
