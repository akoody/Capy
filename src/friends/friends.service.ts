import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FriendRequest, FriendRequestDocument } from './schemas/friend-request.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class FriendsService implements OnModuleInit {
  constructor(
    @InjectModel(FriendRequest.name) private friendRequestModel: Model<FriendRequestDocument>,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  private async seed() {
    const count = await this.friendRequestModel.countDocuments();
    if (count > 0) {
      return;
    }

    const users = await this.usersService.findAll();
    if (users.length < 2) {
      return;
    }

    await this.friendRequestModel.create([
      {
        requester: users[0]._id,
        recipient: users[1]._id,
      },
    ]);
  }

  async create(requesterId: string, recipientId: string): Promise<FriendRequest> {
    const friendRequest = new this.friendRequestModel({ requester: requesterId, recipient: recipientId });
    return friendRequest.save();
  }

  async accept(id: string): Promise<FriendRequest | null> {
    const friendRequest = await this.friendRequestModel.findById(id).populate('requester').populate('recipient').exec();
    if (friendRequest) {
      await this.usersService.addFriend((friendRequest.requester as any)._id, (friendRequest.recipient as any)._id);
      await this.usersService.addFriend((friendRequest.recipient as any)._id, (friendRequest.requester as any)._id);
      friendRequest.status = 'accepted';
      return friendRequest.save();
    }
    return null;
  }

  async reject(id: string): Promise<FriendRequest | null> {
    return this.friendRequestModel.findByIdAndUpdate(id, { status: 'rejected' }, { new: true }).exec();
  }

  async findAllForUser(userId: string): Promise<FriendRequest[]> {
    return this.friendRequestModel.find({ $or: [{ requester: userId }, { recipient: userId }] }).populate('requester').populate('recipient').exec();
  }
}
