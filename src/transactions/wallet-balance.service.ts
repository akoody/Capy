import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import {
  PiggyBank,
  PiggyBankDocument,
} from '../piggy-bank/schemas/piggy-bank.schema';

/** Единственное место, где меняется баланс кошелька. */
@Injectable()
export class WalletBalanceService {
  constructor(
    @InjectModel(PiggyBank.name)
    private readonly wallets: Model<PiggyBankDocument>,
  ) {}

  /** Атомарное пополнение; кошелёк создаётся при первом зачислении. */
  async credit(
    userId: string,
    amountMinor: number,
    session?: ClientSession,
  ): Promise<PiggyBankDocument> {
    return this.wallets
      .findOneAndUpdate(
        { user: userId },
        { $inc: { amountMinor } },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      )
      .orFail()
      .exec();
  }

  /** Атомарное списание: остаток проверяется в том же запросе. */
  async debit(
    userId: string,
    amountMinor: number,
    session?: ClientSession,
  ): Promise<PiggyBankDocument> {
    const wallet = await this.wallets
      .findOneAndUpdate(
        { user: userId, amountMinor: { $gte: amountMinor } },
        { $inc: { amountMinor: -amountMinor } },
        { new: true, session },
      )
      .exec();

    if (!wallet) {
      throw new BadRequestException('Недостаточно средств на кошельке');
    }
    return wallet;
  }

  /** Положительная дельта зачисляет, отрицательная списывает. */
  apply(userId: string, deltaMinor: number, session?: ClientSession) {
    return deltaMinor >= 0
      ? this.credit(userId, deltaMinor, session)
      : this.debit(userId, -deltaMinor, session);
  }
}
