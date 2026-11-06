import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Achievement, AchievementDocument } from './schemas/achievement.schema';

@Injectable()
export class AchievementsService implements OnModuleInit {
  constructor(
    @InjectModel(Achievement.name)
    private achievementModel: Model<AchievementDocument>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  private async seed() {
    const achievementsToSeed = [
      {
        key: 'FIRST_GOAL',
        name: 'Первая цель',
        description: 'Вы создали свою первую цель.',
        icon: '🏆',
      },
      {
        key: 'MARATHONER',
        name: 'Марафонец',
        description: 'Вы регулярно пополняли счет в течение месяца.',
        icon: '💪',
      },
      {
        key: 'GURU',
        name: 'Финансовый гуру',
        description: 'Вы прочитали 10 советов.',
        icon: '🧠',
      },
      {
        key: 'TARGET_REACHED',
        name: 'Цель достигнута',
        description: 'Вы успешно завершили цель.',
        icon: '🎯',
      },
      {
        key: 'SAVER_10K',
        name: 'Накопитель',
        description: 'Вы накопили свои первые 10 000 ₽.',
        icon: '💰',
      },
      {
        key: 'GOAL_MASTER_5',
        name: 'Мастер целей',
        description: 'Вы достигли 5 целей.',
        icon: '⭐',
      },
      {
        key: 'STREAK_4',
        name: 'На волне',
        description: 'Вы пополняли копилку 4 недели подряд.',
        icon: '🌊',
      },
    ];

    for (const ach of achievementsToSeed) {
      const existing = await this.achievementModel
        .findOne({ key: ach.key })
        .exec();
      if (!existing) {
        await this.achievementModel.create(ach);
      }
    }
  }

  findAll(): Promise<Achievement[]> {
    return this.achievementModel.find().exec();
  }

  findOneByKey(key: string): Promise<AchievementDocument | null> {
    return this.achievementModel.findOne({ key }).exec();
  }
}
