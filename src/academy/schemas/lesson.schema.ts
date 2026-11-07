import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LessonDocument = HydratedDocument<Lesson>;

@Schema({ _id: false })
class Quiz {
  @Prop()
  question!: string;

  @Prop([String])
  options!: string[];

  @Prop()
  correctAnswer!: number;
}

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  content!: string; // Markdown content

  @Prop({ type: Quiz })
  quiz?: Quiz;
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
