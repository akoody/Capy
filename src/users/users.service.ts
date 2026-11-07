import { Injectable, Inject, forwardRef, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { AnalysisRequest, AnalysisRequestDocument } from './schemas/analysis-request.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { AchievementsService } from '../achievements/achievements.service';
import { TransactionsService } from '../transactions/transactions.service';
import { GoalsService } from '../goals/goals.service';
import { GoalDocument } from '../goals/schemas/goal.schema';
import { TransactionDocument } from '../transactions/schemas/transaction.schema';
import type { TelegramUserPayload } from '../auth/telegram-init-data';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(AnalysisRequest.name) private analysisRequestModel: Model<AnalysisRequestDocument>,
    private readonly achievementsService: AchievementsService,
    @Inject(forwardRef(() => TransactionsService)) private readonly transactionsService: TransactionsService,
    @Inject(forwardRef(() => GoalsService)) private readonly goalsService: GoalsService,
  ) {}

  async exportData(userId: string): Promise<string> {
    const goals = await this.goalsService.findAllForUser(userId);
    const transactions = await this.transactionsService.findAllForUser(userId);

    let csv = 'Date,Goal,Transaction Type,Amount\n';

    for (const transaction of transactions) {
      const goal = goals.find(g => (g as GoalDocument)._id.toString() === (transaction.goal as any).toString());
      const date = (transaction as any).createdAt.toISOString().split('T')[0];
      const goalName = goal ? goal.name : 'N/A';
      csv += `${date},${goalName},${transaction.type},${transaction.amount}\n`;
    }

    return csv;
  }

  async getSavingStreak(userId: string): Promise<{ streak: number }> {
    const transactions = await this.transactionsService.findAllForUser(userId);
    const depositDates = transactions
      .filter((t: TransactionDocument) => t.type === 'deposit' && t.createdAt)
      .map((t: TransactionDocument) => t.createdAt.getTime());

    if (depositDates.length === 0) {
      return { streak: 0 };
    }

    const uniqueWeeks = new Set<string>();
    for (const date of depositDates) {
      const d = new Date(date);
      const week = Math.floor(d.getTime() / (1000 * 60 * 60 * 24 * 7));
      uniqueWeeks.add(`${d.getFullYear()}-${week}`);
    }

    const sortedWeeks = Array.from(uniqueWeeks)
      .map((w) => {
        const [, week] = w.split('-').map(Number);
        return week;
      })
      .sort((a, b) => b - a);

    let currentStreak = 0;
    if (sortedWeeks.length > 0) {
      currentStreak = 1;
      for (let i = 0; i < sortedWeeks.length - 1; i++) {
        if (sortedWeeks[i] - sortedWeeks[i + 1] === 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    const now = new Date();
    const currentWeek = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 7));
    if (sortedWeeks[0] !== currentWeek && sortedWeeks[0] !== currentWeek - 1) {
      currentStreak = 0;
    }

    if (currentStreak >= 4) {
      await this.grantAchievement(userId, 'STREAK_4');
    }

    return { streak: currentStreak };
  }

  async completeLesson(userId: string, lessonId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { completedLessons: lessonId } },
      { new: true },
    ).exec();
  }

  async grantAchievement(userId: string, achievementKey: string) {
    const achievement =
      await this.achievementsService.findOneByKey(achievementKey);
    if (!achievement) return;

    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $addToSet: { achievements: achievement._id } },
        { new: true },
      )
      .exec();
  }

  async addPoints(userId: string, points: number): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $inc: { points: points } },
      { new: true },
    ).exec();
  }

  async addBadge(userId: string, badge: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { badges: badge } },
      { new: true },
    ).exec();
  }

  async addCompletedCourse(userId: string, courseId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { completedCourses: courseId } },
      { new: true },
    ).exec();
  }

  async addFriend(userId: string, friendId: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { friends: friendId } },
      { new: true },
    ).exec();
  }

  async getFriends(userId: string): Promise<UserDocument[]> {
    const user = await this.userModel.findById(userId).populate('friends').exec();
    return user ? user.friends as UserDocument[] : [];
  }

  async getLeaderboard(): Promise<UserDocument[]> {
    return this.userModel.find().sort({ points: -1 }).limit(10).exec();
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const createdUser = new this.userModel(createUserDto);
    return createdUser.save();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).populate('achievements').populate('completedLessons').exec();
  }

  async findOrCreateByTelegramUser(telegramUser: TelegramUserPayload): Promise<UserDocument> {
    const existingUser = await this.userModel.findOne({ telegramId: telegramUser.id }).exec();
    if (existingUser) {
      existingUser.firstName = telegramUser.first_name;
      existingUser.lastName = telegramUser.last_name;
      existingUser.username = telegramUser.username;
      existingUser.photoUrl = telegramUser.photo_url;
      return existingUser.save();
    }

    const newUser = new this.userModel({
      telegramId: telegramUser.id,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
      username: telegramUser.username,
      photoUrl: telegramUser.photo_url,
    });

    return newUser.save();
  }

  async findOneByTelegramId(telegramId: number): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ telegramId })
      .populate('achievements')
      .populate('completedLessons')
      .exec();
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async update(id: string, updateData: any): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async checkAnalysisLimit(userId: string, type: 'transactions' | 'savings'): Promise<void> {
    let userObjectId: string;
    if (userId.match(/^[0-9a-fA-F]{24}$/)) {
      userObjectId = userId;
    } else {
      const user = await this.findOneByTelegramId(parseInt(userId, 10));
      if (!user) {
        throw new BadRequestException('Пользователь не найден');
      }
      userObjectId = user._id.toString();
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recentRequests = await this.analysisRequestModel
      .find({
        user: userObjectId,
        type: type,
        timestamp: { $gte: twoHoursAgo },
      })
      .countDocuments()
      .exec();

    if (recentRequests >= 3) {
      throw new BadRequestException(
        `Превышен лимит анализов. Вы можете выполнить максимум 3 анализа ${type === 'transactions' ? 'транзакций' : 'накоплений'} за 2 часа. Пожалуйста, подождите.`
      );
    }
  }

  async recordAnalysisRequest(userId: string, type: 'transactions' | 'savings'): Promise<void> {
    let userObjectId: string;
    if (userId.match(/^[0-9a-fA-F]{24}$/)) {
      userObjectId = userId;
    } else {
      const user = await this.findOneByTelegramId(parseInt(userId, 10));
      if (!user) {
        throw new BadRequestException('Пользователь не найден');
      }
      userObjectId = user._id.toString();
    }

    const analysisRequest = new this.analysisRequestModel({
      user: userObjectId,
      type: type,
      timestamp: new Date(),
    });
    await analysisRequest.save();
  }

  private async resolveUserObjectId(userId: string): Promise<string> {
    if (userId.match(/^[0-9a-fA-F]{24}$/)) {
      return userId;
    }
    const user = await this.findOneByTelegramId(parseInt(userId, 10));
    if (!user) {
      throw new BadRequestException('Пользователь не найден');
    }
    return user._id.toString();
  }

  /** Rolling 1h window; separate from transaction/savings analysis limits. */
  async checkVoiceCommandLimit(userId: string): Promise<void> {
    const userObjectId = await this.resolveUserObjectId(userId);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentRequests = await this.analysisRequestModel
      .find({
        user: userObjectId,
        type: 'voice',
        timestamp: { $gte: oneHourAgo },
      })
      .countDocuments()
      .exec();

    if (recentRequests >= 40) {
      throw new BadRequestException(
        'Превышен лимит голосовых команд (40 в час). Подождите немного и попробуйте снова.',
      );
    }
  }

  async recordVoiceCommandRequest(userId: string): Promise<void> {
    const userObjectId = await this.resolveUserObjectId(userId);
    const analysisRequest = new this.analysisRequestModel({
      user: userObjectId,
      type: 'voice',
      timestamp: new Date(),
    });
    await analysisRequest.save();
  }
}