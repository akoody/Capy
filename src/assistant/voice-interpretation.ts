import type {
  VoiceIntent,
  VoiceInterpretBatch,
  VoiceInterpretResult,
  VoiceTransactionDeleteMode,
} from './voice-intent.types';

/** Чистые правила разбора ответа модели: без сети, базы и состояния. */

/**
 * Строка из значения JSON, пришедшего от модели. Объекты и массивы считаются
 * отсутствующим значением, а не превращаются в «[object Object]».
 */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

export function opShortLabel(op: VoiceInterpretResult): string {
  const a = op.amount ?? 0;
  switch (op.intent) {
    case 'create_expense':
      return `расход ${a}`;
    case 'create_income':
      return `доход ${a}`;
    case 'wallet_deposit':
      return `кошелёк +${a}`;
    case 'wallet_withdraw':
      return `кошелёк −${a}`;
    case 'goal_create':
      return `цель ${a}`;
    case 'goal_deposit':
      return `в цель ${a}`;
    case 'goal_withdraw':
      return `из цели ${a}`;
    case 'task_create':
      return `задача`;
    case 'task_complete':
      return `задача ✓`;
    case 'task_cancel':
      return `задача ✕`;
    case 'task_delete':
      return `задача удал.`;
    case 'task_update':
      return `задача правка`;
    case 'journal_create':
      return `дневник`;
    case 'budget_create':
      return `бюджет`;
    case 'category_create':
      return `категория`;
    case 'transaction_delete':
      return `удал. транз.`;
    case 'goal_delete':
      return `цель ✕`;
    case 'wallet_balance':
      return `баланс`;
    default:
      return op.intent;
  }
}

export function voiceItemNeedsPositiveAmount(i: VoiceInterpretResult): boolean {
  if (i.intent === 'unknown') return false;
  if (
    i.intent === 'task_create' ||
    i.intent === 'task_complete' ||
    i.intent === 'task_cancel' ||
    i.intent === 'task_delete' ||
    i.intent === 'task_update' ||
    i.intent === 'wallet_balance' ||
    i.intent === 'journal_create' ||
    i.intent === 'category_create' ||
    i.intent === 'transaction_delete' ||
    i.intent === 'goal_delete'
  ) {
    return false;
  }
  return true;
}

export function isVoiceItemExecutable(i: VoiceInterpretResult): boolean {
  if (i.intent === 'unknown' || i.confidence < 0.45) return false;
  if (voiceItemNeedsPositiveAmount(i)) {
    if (i.amount == null || i.amount <= 0) return false;
  }
  switch (i.intent) {
    case 'task_create':
      return Boolean(i.task_title?.trim() || i.description?.trim());
    case 'task_complete':
    case 'task_cancel':
    case 'task_delete':
      return Boolean(i.task_title?.trim() || i.description?.trim());
    case 'task_update': {
      const hint = (i.task_title || i.description || '').trim();
      if (!hint) return false;
      return Boolean(
        i.new_task_title?.trim() ||
          i.date?.trim() ||
          i.priority ||
          i.reminder_at?.trim() ||
          (i.reminder_times && i.reminder_times.length > 0),
      );
    }
    case 'goal_create':
      return Boolean(i.goal_name?.trim() || i.description?.trim());
    case 'goal_deposit':
    case 'goal_withdraw':
      return Boolean(
        i.goal_name?.trim() || i.category?.trim() || i.description?.trim(),
      );
    case 'goal_delete':
      return Boolean(i.goal_name?.trim() || i.description?.trim());
    case 'wallet_balance':
      return true;
    case 'journal_create':
      return Boolean(
        (i.journal_content || i.description || '').trim().length > 0,
      );
    case 'budget_create':
      return Boolean(
        i.amount != null &&
          i.amount > 0 &&
          i.category?.trim() &&
          (i.budget_name?.trim() || i.description?.trim()) &&
          (i.budget_period === 'weekly' || i.budget_period === 'monthly'),
      );
    case 'category_create':
      return Boolean(i.category?.trim() && i.category_kind);
    case 'transaction_delete':
      return Boolean(i.delete_mode);
    default:
      return i.amount != null && i.amount > 0;
  }
}

/**
 * LLM часто занижает confidence (и для коротких «еда 1000», и для длинных рассказов со суммами).
 * Если уже извлечены исполняемое намерение и положительная сумма, поднимаем пол до порога.
 */
export function applyStructuralConfidenceFloor(
  interpreted: VoiceInterpretResult,
  transcript: string,
): VoiceInterpretResult {
  if (interpreted.intent === 'unknown') {
    return interpreted;
  }

  const needsAmount: VoiceIntent[] = [
    'create_expense',
    'create_income',
    'wallet_deposit',
    'wallet_withdraw',
    'goal_create',
    'goal_deposit',
    'goal_withdraw',
  ];
  if (
    needsAmount.includes(interpreted.intent) &&
    (!interpreted.amount || interpreted.amount <= 0)
  ) {
    return interpreted;
  }

  const actionable: VoiceIntent[] = [
    'create_expense',
    'create_income',
    'wallet_deposit',
    'wallet_withdraw',
    'wallet_balance',
    'goal_create',
    'goal_deposit',
    'goal_withdraw',
    'goal_delete',
    'task_create',
    'task_complete',
    'task_cancel',
    'task_delete',
    'task_update',
    'journal_create',
    'budget_create',
    'category_create',
    'transaction_delete',
  ];
  if (!actionable.includes(interpreted.intent)) {
    return interpreted;
  }

  const t = transcript.trim();
  const hasDigit = /\d/.test(t);
  const hasCategoryOrDesc = Boolean(
    interpreted.category?.trim() ||
      interpreted.description?.trim() ||
      interpreted.journal_content?.trim(),
  );
  const hasTaskGoal = Boolean(
    interpreted.task_title?.trim() || interpreted.goal_name?.trim(),
  );
  const wordCount = t.split(/\s+/).filter(Boolean).length;

  const hasCue =
    hasDigit ||
    hasCategoryOrDesc ||
    hasTaskGoal ||
    interpreted.intent === 'wallet_balance' ||
    (interpreted.intent === 'transaction_delete' &&
      Boolean(interpreted.delete_mode));
  const withinNormalVoiceLength = wordCount <= 80 && t.length <= 1500;

  if (!hasCue || !withinNormalVoiceLength) {
    return interpreted;
  }

  const floor = 0.55;
  if (interpreted.confidence >= floor) {
    return interpreted;
  }
  return { ...interpreted, confidence: floor };
}

export function applyStructuralConfidenceFloorBatch(
  batch: VoiceInterpretBatch,
  transcript: string,
): VoiceInterpretBatch {
  return {
    ...batch,
    items: batch.items.map((item) =>
      applyStructuralConfidenceFloor(item, transcript),
    ),
  };
}

export function parseOneVoiceOperation(
  data: Record<string, unknown>,
  today: string,
): VoiceInterpretResult {
  const intentRaw = textOf(data.intent) || 'unknown';
  const allowed: VoiceIntent[] = [
    'create_expense',
    'create_income',
    'wallet_deposit',
    'wallet_withdraw',
    'wallet_balance',
    'goal_create',
    'goal_deposit',
    'goal_withdraw',
    'goal_delete',
    'task_create',
    'task_complete',
    'task_cancel',
    'task_delete',
    'task_update',
    'journal_create',
    'budget_create',
    'category_create',
    'transaction_delete',
    'unknown',
  ];
  const intent = allowed.includes(intentRaw as VoiceIntent)
    ? (intentRaw as VoiceIntent)
    : 'unknown';

  const confidence = Math.min(1, Math.max(0, Number(data.confidence) || 0));
  let amount: number | null =
    typeof data.amount === 'number' && !Number.isNaN(data.amount)
      ? data.amount
      : null;
  if (amount === null && data.amount != null) {
    const n = parseFloat(textOf(data.amount).replace(',', '.'));
    amount = !Number.isNaN(n) ? n : null;
  }
  if (amount !== null) {
    amount = Math.round(amount * 100) / 100;
  }

  const category =
    data.category != null && textOf(data.category).trim()
      ? textOf(data.category).trim()
      : null;
  const description =
    data.description != null && textOf(data.description).trim()
      ? textOf(data.description).trim()
      : null;

  let date =
    data.date != null && textOf(data.date).trim()
      ? textOf(data.date).trim().slice(0, 10)
      : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    date = today;
  }

  const affect_wallet = Boolean(data.affect_wallet);
  const reply_hint =
    data.reply_hint != null ? textOf(data.reply_hint).trim() : '';

  const goal_name =
    data.goal_name != null && textOf(data.goal_name).trim()
      ? textOf(data.goal_name).trim()
      : null;
  const task_title =
    data.task_title != null && textOf(data.task_title).trim()
      ? textOf(data.task_title).trim()
      : null;
  const pr = data.priority;
  let priority: 'low' | 'medium' | 'high' | null = null;
  if (pr === 'low' || pr === 'medium' || pr === 'high') {
    priority = pr;
  }
  const reminder_at =
    data.reminder_at != null && textOf(data.reminder_at).trim()
      ? textOf(data.reminder_at).trim()
      : null;
  let reminder_times: string[] | null = null;
  if (Array.isArray(data.reminder_times)) {
    const arr = data.reminder_times
      .map((x) => textOf(x).trim())
      .filter(Boolean);
    reminder_times = arr.length > 0 ? arr : null;
  }

  const journal_content =
    data.journal_content != null && textOf(data.journal_content).trim()
      ? textOf(data.journal_content).trim()
      : null;
  const journal_title =
    data.journal_title != null && textOf(data.journal_title).trim()
      ? textOf(data.journal_title).trim()
      : null;
  let journal_tags: string[] | null = null;
  if (Array.isArray(data.journal_tags)) {
    const arr = data.journal_tags.map((x) => textOf(x).trim()).filter(Boolean);
    journal_tags = arr.length > 0 ? arr : null;
  }

  const budget_name =
    data.budget_name != null && textOf(data.budget_name).trim()
      ? textOf(data.budget_name).trim()
      : null;
  const bp = data.budget_period;
  const budget_period = bp === 'weekly' || bp === 'monthly' ? bp : null;

  const ck = data.category_kind;
  const category_kind =
    ck === 'expense' || ck === 'income' || ck === 'both' ? ck : null;

  const dm = data.delete_mode;
  const delete_mode: VoiceTransactionDeleteMode | null =
    dm === 'last_expense' ||
    dm === 'last_income' ||
    dm === 'last_any' ||
    dm === 'match'
      ? dm
      : null;

  const new_task_title =
    data.new_task_title != null && textOf(data.new_task_title).trim()
      ? textOf(data.new_task_title).trim()
      : null;

  return {
    intent,
    confidence,
    amount,
    category,
    description,
    date,
    affect_wallet,
    reply_hint,
    goal_name,
    task_title,
    priority,
    reminder_at,
    reminder_times,
    journal_content,
    journal_title,
    journal_tags,
    budget_name,
    budget_period,
    category_kind,
    delete_mode,
    new_task_title,
  };
}

export function safeParseInterpret(
  raw: string,
  today: string,
): VoiceInterpretBatch {
  const unknownBatch = (reply: string): VoiceInterpretBatch => ({
    items: [
      {
        intent: 'unknown',
        confidence: 0,
        amount: null,
        category: null,
        description: null,
        date: today,
        affect_wallet: false,
        reply_hint: reply,
      },
    ],
    batch_reply_hint: '',
  });

  let jsonStr: string;
  try {
    jsonStr = extractJsonObject(raw);
  } catch {
    return unknownBatch('Не удалось разобрать ответ ИИ (нет JSON)');
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return unknownBatch('Не удалось разобрать ответ ИИ');
  }

  /** Модели иногда отдают массив операций без обёртки { operations: [...] } */
  if (Array.isArray(data)) {
    const items: VoiceInterpretResult[] = [];
    for (const el of data) {
      if (el && typeof el === 'object' && !Array.isArray(el)) {
        items.push(
          parseOneVoiceOperation(el as Record<string, unknown>, today),
        );
      }
    }
    if (items.length === 0) {
      return unknownBatch('Некорректный массив операций');
    }
    return { items, batch_reply_hint: '' };
  }

  if (data && typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    const batch_reply_hint =
      obj.batch_reply_hint != null ? textOf(obj.batch_reply_hint).trim() : '';

    const opsRaw = obj.operations ?? obj.items;
    if (Array.isArray(opsRaw)) {
      if (opsRaw.length === 0) {
        return unknownBatch('Пустой список operations');
      }
      const items: VoiceInterpretResult[] = [];
      for (const el of opsRaw) {
        if (el && typeof el === 'object' && !Array.isArray(el)) {
          items.push(
            parseOneVoiceOperation(el as Record<string, unknown>, today),
          );
        }
      }
      if (items.length === 0) {
        return unknownBatch('Некорректные элементы operations');
      }
      return { items, batch_reply_hint };
    }

    /** Одна операция ошибочно положена как объект вместо массива */
    if (
      opsRaw &&
      typeof opsRaw === 'object' &&
      !Array.isArray(opsRaw) &&
      typeof (opsRaw as Record<string, unknown>).intent === 'string'
    ) {
      return {
        items: [
          parseOneVoiceOperation(opsRaw as Record<string, unknown>, today),
        ],
        batch_reply_hint,
      };
    }

    return {
      items: [parseOneVoiceOperation(obj, today)],
      batch_reply_hint,
    };
  }

  return unknownBatch('Не удалось разобрать ответ ИИ');
}

export function extractJsonObject(raw: string): string {
  const cleaned = raw.replace(/^\uFEFF/, '').trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : cleaned;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('No JSON object');
  }
  return candidate.slice(start, end + 1);
}
