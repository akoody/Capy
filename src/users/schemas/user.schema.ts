import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Achievement } from '../../achievements/schemas/achievement.schema';

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ required: true, unique: true, index: true })
  telegramId!: number;

  @Prop()
  firstName!: string;

  @Prop()
  lastName?: string;

  @Prop()
  username?: string;

  @Prop()
  photoUrl?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Achievement' }] })
  achievements!: Achievement[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Lesson' }] })
  completedLessons!: Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Course' }] })
  completedCourses!: Types.ObjectId[];

  @Prop({ default: 0 })
  points!: number;

  @Prop({ type: [String], default: [] })
  badges!: string[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  friends!: User[];

  @Prop({ default: 'USD' })
  currency!: string;

  @Prop({ default: 'ru' })
  language!: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.virtual('level').get(function () {
  const points = this.points;
  if (points < 100) return 1;
  if (points < 250) return 2;
  if (points < 500) return 3;
  if (points < 1000) return 4;
  return 5;
});
