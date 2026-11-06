import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Budget, BudgetDocument } from './schemas/budget.schema';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class BudgetsService implements OnModuleInit {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
    private readonly usersService: UsersService,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  private async seed() {
    const count = await this.budgetModel.countDocuments();
    if (count > 0) {
      return;
    }

    const users = await this.usersService.findAll();
    if (users.length === 0) {
      return;
    }

    await this.budgetModel.create([
      {
        name: 'Groceries',
        amount: 20000,
        category: 'Food',
        period: 'monthly',
        user: users[0]._id,
      },
      {
        name: 'Entertainment',
        amount: 10000,
        category: 'Fun',
        period: 'monthly',
        user: users[0]._id,
      },
    ]);
  }

  async create(createBudgetDto: CreateBudgetDto): Promise<Budget> {
    const { userId, ...rest } = createBudgetDto;
    const createdBudget = new this.budgetModel({
      ...rest,
      user: userId,
    });
    return createdBudget.save();
  }

  async findAllForUser(userId: string): Promise<Budget[]> {
    return this.budgetModel.find({ user: userId }).exec();
  }

  async findOne(id: string): Promise<Budget | null> {
    return this.budgetModel.findById(id).exec();
  }

  async remove(id: string): Promise<any> {
    return this.budgetModel.findByIdAndDelete(id).exec();
  }
}
