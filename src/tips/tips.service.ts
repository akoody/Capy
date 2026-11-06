import { Injectable } from '@nestjs/common';

export interface Tip {
  title: string;
  content: string;
}

@Injectable()
export class TipsService {
  private readonly tips: Tip[] = [
    {
      title: 'Правило 50/30/20',
      content:
        'Распределяйте свой доход: 50% на нужды, 30% на желания и 20% на сбережения и погашение долгов.',
    },
    {
      title: 'Сначала заплати себе',
      content:
        'Сразу после получения дохода отложите часть на сбережения, и только потом тратьте остальное.',
    },
    {
      title: 'Избегайте импульсивных покупок',
      content:
        'Перед тем как что-то купить, подождите 24 часа. Это поможет понять, действительно ли вам нужна эта вещь.',
    },
    {
      title: 'Финансовая подушка',
      content:
        'Стремитесь накопить сумму, равную вашим расходам за 3-6 месяцев. Это ваша страховка на случай непредвиденных ситуаций.',
    },
    {
      title: 'Автоматизируйте накопления',
      content:
        'Настройте автоматический перевод части средств на сберегательный счет в день зарплаты.',
    },
  ];

  findAll(): Tip[] {
    return this.tips;
  }

  findRandom(): Tip {
    const randomIndex = Math.floor(Math.random() * this.tips.length);
    return this.tips[randomIndex];
  }
}
