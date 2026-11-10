import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ownedBy, orNotFound } from '../common/owned-by';
import { toMinor } from '../common/money';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalAmountDto } from './dto/update-goal-amount.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { SetupRecurringTransactionDto } from './dto/setup-recurring-transaction.dto';

const SAVER_10K_MINOR = toMinor(10_000);

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(userId: string, createGoalDto: CreateGoalDto): Promise<Goal> {
    const createdGoal = new this.goalModel({ ...createGoalDto, user: userId });
    await createdGoal.save();

    // Check for first goal achievement
    const userGoalsCount = await this.goalModel.countDocuments({
      user: userId,
    });
    if (userGoalsCount === 1) {
      await this.usersService.grantAchievement(userId, 'FIRST_GOAL');
    }

    return createdGoal;
  }

  async findAllForUser(userId: string): Promise<GoalDocument[]> {
    return this.goalModel.find({ user: userId }).exec();
  }

  async findOne(userId: string, id: string): Promise<GoalDocument> {
    const goal = await this.goalModel.findOne(ownedBy(userId, id)).exec();
    return orNotFound(goal, 'Goal');
  }

  async deposit(
    userId: string,
    id: string,
    updateGoalAmountDto: UpdateGoalAmountDto,
  ): Promise<Goal> {
    const updatedGoal = orNotFound(
      await this.goalModel
        .findOneAndUpdate(
          ownedBy(userId, id),
          { $inc: { currentAmountMinor: toMinor(updateGoalAmountDto.amount) } },
          { new: true },
        )
        .exec(),
      'Goal',
    );

    // Check for achievements
    const totalSavingsAggregation = await this.goalModel.aggregate<{
      total: number;
    }>([
      { $match: { user: updatedGoal.user } },
      { $group: { _id: null, total: { $sum: '$currentAmountMinor' } } },
    ]);
    const totalSavingsMinor = totalSavingsAggregation[0]?.total || 0;

    if (totalSavingsMinor >= SAVER_10K_MINOR) {
      await this.usersService.grantAchievement(userId, 'SAVER_10K');
    }

    if (updatedGoal.currentAmountMinor >= updatedGoal.targetAmountMinor) {
      await this.usersService.grantAchievement(userId, 'TARGET_REACHED');
      const completedGoalsCount = await this.goalModel.countDocuments({
        user: updatedGoal.user,
        $expr: { $gte: ['$currentAmountMinor', '$targetAmountMinor'] },
      });
      if (completedGoalsCount >= 5) {
        await this.usersService.grantAchievement(userId, 'GOAL_MASTER_5');
      }
    }

    return updatedGoal;
  }

  async withdraw(
    userId: string,
    id: string,
    updateGoalAmountDto: UpdateGoalAmountDto,
  ): Promise<Goal> {
    const amountMinor = toMinor(updateGoalAmountDto.amount);
    // Проверка остатка и списание идут одним запросом, параллельно в минус не уйти.
    const updated = await this.goalModel
      .findOneAndUpdate(
        { ...ownedBy(userId, id), currentAmountMinor: { $gte: amountMinor } },
        { $inc: { currentAmountMinor: -amountMinor } },
        { new: true },
      )
      .exec();

    if (updated) {
      return updated;
    }

    await this.findOne(userId, id);
    throw new BadRequestException(
      'Withdrawal amount cannot be greater than the current amount.',
    );
  }

  async setupRecurringTransaction(
    userId: string,
    id: string,
    setupRecurringTransactionDto: SetupRecurringTransactionDto,
  ): Promise<Goal> {
    return this.updateOwned(userId, id, {
      $set: {
        recurringTransaction: {
          amountMinor: toMinor(setupRecurringTransactionDto.amount),
          frequency: setupRecurringTransactionDto.frequency,
          startDate: setupRecurringTransactionDto.startDate,
        },
      },
    });
  }

  async restore(userId: string, id: string): Promise<Goal> {
    const goal = await this.findOne(userId, id);
    // Reset the goal to make it active again by setting current amount to target - 1
    return this.updateOwned(userId, id, {
      $set: {
        currentAmountMinor: Math.max(0, goal.targetAmountMinor - toMinor(1)),
      },
    });
  }

  async updateNotes(userId: string, id: string, notes: string): Promise<Goal> {
    return this.updateOwned(userId, id, { $set: { notes } });
  }

  async remove(userId: string, id: string): Promise<Goal> {
    return orNotFound(
      await this.goalModel.findOneAndDelete(ownedBy(userId, id)).exec(),
      'Goal',
    );
  }

  async removeRecurring(userId: string, id: string): Promise<Goal> {
    return this.updateOwned(userId, id, {
      $unset: { recurringTransaction: 1 },
    });
  }

  private async updateOwned(
    userId: string,
    id: string,
    update: Record<string, unknown>,
  ): Promise<GoalDocument> {
    return orNotFound(
      await this.goalModel
        .findOneAndUpdate(ownedBy(userId, id), update, { new: true })
        .exec(),
      'Goal',
    );
  }
}
