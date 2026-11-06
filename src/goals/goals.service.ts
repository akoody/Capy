import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ownedBy, orNotFound } from '../common/owned-by';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalAmountDto } from './dto/update-goal-amount.dto';
import { UsersService } from '../users/users.service';
import { TransactionsService } from '../transactions/transactions.service';
import { SetupRecurringTransactionDto } from './dto/setup-recurring-transaction.dto';

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
    const goal = await this.findOne(userId, id);

    const updatedGoal = orNotFound(
      await this.goalModel
        .findOneAndUpdate(
          ownedBy(userId, id),
          { $inc: { currentAmount: updateGoalAmountDto.amount } },
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
      { $group: { _id: null, total: { $sum: '$currentAmount' } } },
    ]);
    const totalSavings = totalSavingsAggregation[0]?.total || 0;

    if (totalSavings >= 10000) {
      await this.usersService.grantAchievement(userId, 'SAVER_10K');
    }

    if (updatedGoal.currentAmount >= updatedGoal.targetAmount) {
      await this.usersService.grantAchievement(userId, 'TARGET_REACHED');
      const completedGoalsCount = await this.goalModel.countDocuments({
        user: updatedGoal.user,
        currentAmount: { $gte: goal.targetAmount },
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
    const goal = await this.findOne(userId, id);

    if (goal.currentAmount < updateGoalAmountDto.amount) {
      throw new BadRequestException(
        'Withdrawal amount cannot be greater than the current amount.',
      );
    }

    // No transaction logging for goal withdrawals
    return orNotFound(
      await this.goalModel
        .findOneAndUpdate(
          ownedBy(userId, id),
          { $inc: { currentAmount: -updateGoalAmountDto.amount } },
          { new: true },
        )
        .exec(),
      'Goal',
    );
  }

  async setupRecurringTransaction(
    userId: string,
    id: string,
    setupRecurringTransactionDto: SetupRecurringTransactionDto,
  ): Promise<Goal> {
    return this.updateOwned(userId, id, {
      $set: { recurringTransaction: setupRecurringTransactionDto },
    });
  }

  async restore(userId: string, id: string): Promise<Goal> {
    const goal = await this.findOne(userId, id);
    // Reset the goal to make it active again by setting current amount to target - 1
    return this.updateOwned(userId, id, {
      $set: { currentAmount: Math.max(0, goal.targetAmount - 1) },
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
