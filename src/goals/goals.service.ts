import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Goal, GoalDocument } from './schemas/goal.schema';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalAmountDto } from './dto/update-goal-amount.dto';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schemas/user.schema';
import { TransactionsService } from '../transactions/transactions.service';
import { SetupRecurringTransactionDto } from './dto/setup-recurring-transaction.dto';

@Injectable()
export class GoalsService {
  constructor(
    @InjectModel(Goal.name) private goalModel: Model<GoalDocument>,
    @Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(createGoalDto: CreateGoalDto): Promise<Goal> {
    const createdGoal = new this.goalModel({
      ...createGoalDto,
      user: createGoalDto.userId,
    });
    await createdGoal.save();

    // Check for first goal achievement
    const userGoalsCount = await this.goalModel.countDocuments({ user: createGoalDto.userId });
    if (userGoalsCount === 1) {
      await this.usersService.grantAchievement(
        createGoalDto.userId,
        'FIRST_GOAL',
      );
    }

    return createdGoal;
  }

  async findAllForUser(userId: string): Promise<Goal[]> {
    return this.goalModel.find({ user: userId }).exec();
  }

  async findOne(id: string): Promise<Goal | null> {
    return this.goalModel.findById(id).exec();
  }

  async deposit(
    id: string,
    updateGoalAmountDto: UpdateGoalAmountDto,
  ): Promise<Goal | null> {
    const goal = await this.findOne(id);
    if (!goal) throw new BadRequestException('Goal not found.');

    const updatedGoal = await this.goalModel
      .findByIdAndUpdate(
        id,
        { $inc: { currentAmount: updateGoalAmountDto.amount } },
        { new: true },
      )
      .exec();

    if (updatedGoal) {
      const userId = (updatedGoal.user as UserDocument)._id.toString();

      // Check for achievements
      const totalSavingsAggregation = await this.goalModel.aggregate([
        { $match: { user: (updatedGoal.user as UserDocument)._id } },
        { $group: { _id: null, total: { $sum: '$currentAmount' } } },
      ]);
      const totalSavings = totalSavingsAggregation[0]?.total || 0;

      if (totalSavings >= 10000) {
        await this.usersService.grantAchievement(userId, 'SAVER_10K');
      }

      if (updatedGoal.currentAmount >= updatedGoal.targetAmount) {
        await this.usersService.grantAchievement(userId, 'TARGET_REACHED');
        const completedGoalsCount = await this.goalModel.countDocuments({
          user: (updatedGoal.user as UserDocument)._id,
          currentAmount: { $gte: goal.targetAmount },
        });
        if (completedGoalsCount >= 5) {
          await this.usersService.grantAchievement(userId, 'GOAL_MASTER_5');
        }
      }
    }

    return updatedGoal;
  }

  async withdraw(
    id: string,
    updateGoalAmountDto: UpdateGoalAmountDto,
  ): Promise<Goal | null> {
    const goal = await this.findOne(id);
    if (!goal) throw new BadRequestException('Goal not found.');

    if (goal.currentAmount < updateGoalAmountDto.amount) {
      throw new BadRequestException(
        'Withdrawal amount cannot be greater than the current amount.',
      );
    }

    const updatedGoal = await this.goalModel
      .findByIdAndUpdate(
        id,
        { $inc: { currentAmount: -updateGoalAmountDto.amount } },
        { new: true },
      )
      .exec();

    // No transaction logging for goal withdrawals

    return updatedGoal;
  }

  async setupRecurringTransaction(
    id: string,
    setupRecurringTransactionDto: SetupRecurringTransactionDto,
  ): Promise<Goal | null> {
    return this.goalModel
      .findByIdAndUpdate(
        id,
        { recurringTransaction: setupRecurringTransactionDto },
        { new: true },
      )
      .exec();
  }

  async restore(id: string): Promise<Goal | null> {
    const goal = await this.findOne(id);
    if (!goal) throw new BadRequestException('Goal not found.');

    // Reset the goal to make it active again by setting current amount to target - 1
    const updatedGoal = await this.goalModel
      .findByIdAndUpdate(
        id,
        { 
          $set: { 
            currentAmount: Math.max(0, goal.targetAmount - 1) // Set to just below target to make it active
          } 
        },
        { new: true },
      )
      .exec();

    return updatedGoal;
  }

  async updateNotes(id: string, notes: string): Promise<Goal | null> {
    const goal = await this.findOne(id);
    if (!goal) throw new BadRequestException('Goal not found.');

    return this.goalModel
      .findByIdAndUpdate(
        id,
        { $set: { notes } },
        { new: true },
      )
      .exec();
  }

  async remove(id: string): Promise<any> {
    return this.goalModel.findByIdAndDelete(id).exec();
  }

  async removeRecurring(id: string): Promise<Goal | null> {
    const goal = await this.findOne(id);
    if (!goal) throw new BadRequestException('Goal not found.');

    return this.goalModel
      .findByIdAndUpdate(
        id,
        { $unset: { recurringTransaction: 1 } },
        { new: true },
      )
      .exec();
  }
}
