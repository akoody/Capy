import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class GamificationService {
  constructor(private readonly usersService: UsersService) {}

  async awardPoints(userId: string, points: number): Promise<void> {
    await this.usersService.addPoints(userId, points);
  }

  async awardBadge(userId: string, badge: string): Promise<void> {
    await this.usersService.addBadge(userId, badge);
  }

  async getLeaderboard(): Promise<any[]> {
    return this.usersService.getLeaderboard();
  }
}
