import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { orNotFound, ownedBy } from '../common/owned-by';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { Budget, BudgetDocument } from './schemas/budget.schema';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private budgetModel: Model<BudgetDocument>,
  ) {}

  async create(userId: string, dto: CreateBudgetDto): Promise<Budget> {
    return new this.budgetModel({ ...dto, user: userId }).save();
  }

  async findAllForUser(userId: string): Promise<Budget[]> {
    return this.budgetModel.find({ user: userId }).exec();
  }

  async findOne(userId: string, id: string): Promise<Budget> {
    return orNotFound(
      await this.budgetModel.findOne(ownedBy(userId, id)).exec(),
      'Budget',
    );
  }

  async remove(userId: string, id: string): Promise<Budget> {
    return orNotFound(
      await this.budgetModel.findOneAndDelete(ownedBy(userId, id)).exec(),
      'Budget',
    );
  }
}
