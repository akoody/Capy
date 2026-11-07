import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type FriendRequestDocument = HydratedDocument<FriendRequest>;

@Schema({ timestamps: true })
export class FriendRequest {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  requester!: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recipient!: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending',
  })
  status!: 'pending' | 'accepted' | 'rejected';
}

export const FriendRequestSchema = SchemaFactory.createForClass(FriendRequest);
