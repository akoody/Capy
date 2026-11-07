import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { orNotFound } from '../common/owned-by';
import { UsersService } from '../users/users.service';
import {
  FriendRequest,
  FriendRequestDocument,
} from './schemas/friend-request.schema';

/** Поля другого пользователя, которые видны в заявках в друзья. */
const PUBLIC_USER_FIELDS = 'firstName username photoUrl';

@Injectable()
export class FriendsService {
  constructor(
    @InjectModel(FriendRequest.name)
    private friendRequestModel: Model<FriendRequestDocument>,
    private readonly usersService: UsersService,
  ) {}

  /** Заявка всегда отправляется от имени текущего пользователя. */
  async create(
    requesterId: string,
    recipientId: string,
  ): Promise<FriendRequest> {
    if (requesterId === recipientId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }
    if (!(await this.usersService.existsById(recipientId))) {
      throw new NotFoundException('User not found');
    }
    const pending = await this.friendRequestModel.exists({
      status: 'pending',
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });
    if (pending) {
      throw new ConflictException('Friend request already pending');
    }
    return new this.friendRequestModel({
      requester: requesterId,
      recipient: recipientId,
    }).save();
  }

  /** Принять может только получатель и только ожидающую заявку. */
  async accept(userId: string, id: string): Promise<FriendRequest> {
    const request = await this.respond(userId, id, 'accepted');
    const requester = request.requester.toHexString();
    await this.usersService.addFriend(requester, userId);
    await this.usersService.addFriend(userId, requester);
    return request;
  }

  async reject(userId: string, id: string): Promise<FriendRequest> {
    return this.respond(userId, id, 'rejected');
  }

  async findAllForUser(userId: string): Promise<FriendRequest[]> {
    return this.friendRequestModel
      .find({ $or: [{ requester: userId }, { recipient: userId }] })
      .populate('requester', PUBLIC_USER_FIELDS)
      .populate('recipient', PUBLIC_USER_FIELDS)
      .exec();
  }

  private async respond(
    userId: string,
    id: string,
    status: 'accepted' | 'rejected',
  ): Promise<FriendRequestDocument> {
    if (!isValidObjectId(id)) throw new NotFoundException();
    return orNotFound(
      await this.friendRequestModel
        .findOneAndUpdate(
          { _id: id, recipient: userId, status: 'pending' },
          { $set: { status } },
          { new: true },
        )
        .exec(),
      'Friend request',
    );
  }
}
