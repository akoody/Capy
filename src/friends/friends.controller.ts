import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { FriendsService } from './friends.service';

@Controller('friends')
export class FriendsController {
  constructor(private readonly friendsService: FriendsService) {}

  @Post()
  create(@Body() body: { requesterId: string, recipientId: string }) {
    return this.friendsService.create(body.requesterId, body.recipientId);
  }

  @Post(':id/accept')
  accept(@Param('id') id: string) {
    return this.friendsService.accept(id);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string) {
    return this.friendsService.reject(id);
  }

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.friendsService.findAllForUser(userId);
  }
}
