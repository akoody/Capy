import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUserId } from '../auth/current-account';
import { CreateFriendRequestDto } from './dto/create-friend-request.dto';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateFriendRequestDto) {
    return this.friendsService.create(userId, dto.recipientId);
  }

  @Post(':id/accept')
  accept(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.friendsService.accept(userId, id);
  }

  @Post(':id/reject')
  reject(@CurrentUserId() userId: string, @Param('id') id: string) {
    return this.friendsService.reject(userId, id);
  }

  @Get()
  findAll(@CurrentUserId() userId: string) {
    return this.friendsService.findAllForUser(userId);
  }
}
