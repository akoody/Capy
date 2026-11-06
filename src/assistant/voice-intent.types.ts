export type VoiceIntent =
  | 'create_expense'
  | 'create_income'
  | 'wallet_deposit'
  | 'wallet_withdraw'
  | 'wallet_balance'
  | 'goal_create'
  | 'goal_deposit'
  | 'goal_withdraw'
  | 'goal_delete'
  | 'task_create'
  | 'task_complete'
  | 'task_cancel'
  | 'task_delete'
  | 'task_update'
  | 'journal_create'
  | 'budget_create'
  | 'category_create'
  | 'transaction_delete'
  | 'unknown';

/** Для transaction_delete: как выбрать операцию */
export type VoiceTransactionDeleteMode =
  | 'last_expense'
  | 'last_income'
  | 'last_any'
  | 'match';

export type VoiceTaskPriority = 'low' | 'medium' | 'high';

export interface VoiceInterpretResult {
  intent: VoiceIntent;
  confidence: number;
  amount: number | null;
  category: string | null;
  description: string | null;
  date: string | null;
  affect_wallet: boolean;
  reply_hint: string;
  /** Название цели накопления (голос). */
  goal_name?: string | null;
  /** Заголовок задачи (голос). */
  task_title?: string | null;
  priority?: VoiceTaskPriority | null;
  /** Одно напоминание, ISO datetime. */
  reminder_at?: string | null;
  /** Несколько напоминаний, ISO datetime. */
  reminder_times?: string[] | null;
  /** journal_create: текст записи (основной). */
  journal_content?: string | null;
  /** journal_create: заголовок. */
  journal_title?: string | null;
  /** journal_create: теги. */
  journal_tags?: string[] | null;
  /** budget_create: название лимита. */
  budget_name?: string | null;
  /** budget_create: weekly | monthly. */
  budget_period?: 'weekly' | 'monthly' | null;
  /** category_create: тип новой категории. */
  category_kind?: 'expense' | 'income' | 'both' | null;
  /** transaction_delete */
  delete_mode?: VoiceTransactionDeleteMode | null;
  /** task_update: новое название. */
  new_task_title?: string | null;
}

/** Результат разбора одной голосовой передачи (одна или несколько операций). */
export interface VoiceInterpretBatch {
  items: VoiceInterpretResult[];
  /** Краткое резюме всей фразы от модели (опционально). */
  batch_reply_hint: string;
}

export interface VoiceCommandResponseDto {
  transcript: string;
  intent: VoiceIntent;
  confidence: number;
  message: string;
  executed: boolean;
  /** Первая созданная транзакция (совместимость со старым клиентом). */
  transactionId?: string;
  /** Все созданные транзакции за этот запрос (при пакетной записи). */
  transactionIds?: string[];
  /** True if piggy-bank balance changed (client may refresh wallet UI). */
  walletTouched?: boolean;
  error?: string;
  /** Сколько операций было выполнено успешно (при пакете). */
  successCount?: number;
  /** Сколько операций было в очереди после валидации. */
  operationsAttempted?: number;
}
