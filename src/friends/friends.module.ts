import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FriendRequest, FriendRequestSchema } from './schemas/friend-request.schema';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: FriendRequest.name, schema: FriendRequestSchema }]),
    UsersModule,
  ],
  controllers: [FriendsController],
  providers: [FriendsService],
})
export class FriendsModule {}
