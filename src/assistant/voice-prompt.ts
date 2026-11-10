/** Системный промпт разбора голосовой команды в JSON-пакет операций. */
export function buildSystemPrompt(ctx: {
  currency: string;
  categoriesSample: string[];
  today: string;
  yesterday: string;
  dayBeforeYesterday: string;
  openTaskTitles: string[];
  goalTitles: string[];
  categoryCatalog: {
    name: string;
    kind: string;
    description: string | null;
  }[];
}): string {
  const catalogBlock =
    ctx.categoryCatalog.length > 0
      ? ctx.categoryCatalog
          .map((c) => {
            const kindRu =
              c.kind === 'expense'
                ? 'только расход'
                : c.kind === 'income'
                  ? 'только доход'
                  : 'расход и доход';
            const hint = c.description ? ` | подсказка: ${c.description}` : '';
            return `«${c.name}» (${kindRu})${hint}`;
          })
          .join('\n')
      : '';
  const fallbackNames =
    ctx.categoriesSample.length > 0
      ? ctx.categoriesSample.join(', ')
      : 'ещё не было операций';
  const catLine = catalogBlock
    ? `Справочник категорий (сопоставляй траты/доходы по названию и подсказке):\n${catalogBlock}\n\nИмена из недавних операций (если нет в справочнике, можно добавить новое имя категории): ${fallbackNames}.`
    : `Категории из недавних операций: ${fallbackNames}. Пользователь может завести описания в приложении. Пока справочник пуст, выбирай осмысленные короткие названия.`;
  const tasksLine =
    ctx.openTaskTitles.length > 0
      ? ctx.openTaskTitles.map((t) => `"${t}"`).join(', ')
      : '(активных задач нет)';
  const goalsLine =
    ctx.goalTitles.length > 0
      ? ctx.goalTitles.map((t) => `"${t}"`).join(', ')
      : '(целей нет)';
  return `Ты разбираешь голосовые команды для приложения Capy: финансы, кошелёк, цели, задачи, дневник, бюджеты, категории (одна или несколько операций за раз).
Валюта: ${ctx.currency}.
Календарь (для поля date транзакций и сроков, формат YYYY-MM-DD): сегодня ${ctx.today}, вчера ${ctx.yesterday}, позавчера ${ctx.dayBeforeYesterday}.
${catLine}
Активные задачи (task_complete / task_cancel / task_delete / task_update): ${tasksLine}.
Цели накопления (goal_deposit / goal_withdraw / goal_delete): ${goalsLine}.

Ответь ТОЛЬКО одним JSON-объектом без markdown.
Корень ВСЕГДА только два ключа: "operations" (массив) и "batch_reply_hint" (строка). Нельзя класть intent/amount/category на верхний уровень: даже одна операция это массив из одного элемента.

Форма:
{
"operations": [
  {
    "intent": "create_expense" | "create_income" | "wallet_deposit" | "wallet_withdraw" | "wallet_balance" | "goal_create" | "goal_deposit" | "goal_withdraw" | "goal_delete" | "task_create" | "task_complete" | "task_cancel" | "task_delete" | "task_update" | "journal_create" | "budget_create" | "category_create" | "transaction_delete" | "unknown",
    "confidence": <0..1>,
    "amount": <число или null>,
    "category": <строка или null: для create_expense/create_income: категория; для budget_create: категория лимита (как в тратах); для category_create: имя НОВОЙ категории>,
    "description": <строка или null: детали транзакции; для journal_create можно дублировать смысл, если journal_content пуст>,
    "date": <YYYY-MM-DD или null>,
    "affect_wallet": <boolean>,
    "goal_name": <строка: цель для goal_* и goal_delete>,
    "task_title": <строка: для task_* (подсказка для поиска)>,
    "new_task_title": <строка или null: task_update: новое название>,
    "priority": "low" | "medium" | "high" | null,
    "reminder_at": <ISO datetime или null>,
    "reminder_times": <массив ISO или []>,
    "journal_content": <строка или null: journal_create: основной текст записи>,
    "journal_title": <строка или null>,
    "journal_tags": <массив строк или []>,
    "budget_name": <строка или null: название бюджета>,
    "budget_period": "weekly" | "monthly" | null,
    "category_kind": "expense" | "income" | "both" | null: только category_create,
    "delete_mode": "last_expense" | "last_income" | "last_any" | "match" | null: только transaction_delete,
    "reply_hint": <коротко по операции>
  }
],
"batch_reply_hint": <коротко на всю фразу или "">
}

Пример (две траты в одной фразе: ДВА элемента в operations, не одна сумма):
{"operations":[{"intent":"create_expense","confidence":0.9,"amount":1000,"category":"Еда","description":"бургеры","date":"${ctx.today}","affect_wallet":false,"reply_hint":"−1000 еда"},{"intent":"create_expense","confidence":0.9,"amount":500,"category":"Еда","description":"кофе","date":"${ctx.today}","affect_wallet":false,"reply_hint":"−500 кофе"}],"batch_reply_hint":"Записал две траты"}

Правила:
- Несколько операций: столько же объектов в operations (траты, задачи, цели вперемешку). Не объединяй разные суммы в одну транзакцию.
- Для каждой явной траты/дохода в фразе: отдельный объект; confidence у каждого ≥0.55 если намерение ясное.
- goal_create (новая цель): amount = целевая сумма, goal_name, опционально date как дата цели.
- goal_deposit / goal_withdraw: amount: сумма, goal_name (или по смыслу из фразы).
- task_create: task_title обязателен (или вынь из фразы в description+task_title), priority, date = срок (день), reminder_at / reminder_times в ISO (например завтра 09:00 по локальному смыслу: оцени UTC+3 по умолчанию для РФ).
- task_complete / task_cancel: task_title: сопоставь с активными задачами.
- create_expense: поле category: выбери категорию по смыслу фразы и подсказкам справочника (еда/транспорт/жильё и т.д.). Если фраза явно про подкатегорию («кофе», «такси»): отнеси к родительской категории из справочника по подсказке description. description: конкретика («Starbucks», «Яндекс Такси»). date: день траты.
- create_income: то же: category по смыслу (зарплата, фриланс, подарок…), description: от кого/за что, date: день поступления.
- wallet_deposit / wallet_withdraw: без category/description или null.
- wallet_balance: запрос баланса кошелька («сколько на кошельке»): amount null, reply_hint с формулировкой ответа.
- goal_delete: goal_name по списку целей; amount null.
- task_delete (удалить задачу): task_title; amount null.
- task_update (изменить задачу): task_title (какую найти), опционально new_task_title, date (новый срок), priority, reminder_at/reminder_times; хотя бы одно поле кроме task_title.
- journal_create: journal_content: основной текст; journal_title, journal_tags опционально; date: день записи (по умолчанию ${ctx.today}).
- budget_create: budget_name, amount: лимит, category: категория трат под лимит, budget_period weekly|monthly.
- category_create: category: имя; category_kind expense|income|both; опционально description как подсказка для справочника.
- transaction_delete: delete_mode: last_expense / last_income / last_any: «удали последнюю трату» и т.п.; match: уточни amount и/или category и/или description для поиска последней подходящей транзакции (только расход/доход, не внутренние deposit/withdraw кошелька). amount при match: сумма для сопоставления.
- Суммы: тысяча=1000, полторы тысячи=1500. Не выдумывай числа.
- Несколько разных операций в одной фразе: отдельные объекты в operations.`;
}
