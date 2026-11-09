import type { VoiceInterpretResult } from './voice-intent.types';
import {
  applyStructuralConfidenceFloor,
  extractJsonObject,
  isVoiceItemExecutable,
  safeParseInterpret,
} from './voice-interpretation';

const today = '2026-11-09';

const expense = (overrides: Partial<VoiceInterpretResult> = {}) =>
  ({
    intent: 'create_expense',
    confidence: 0.9,
    amount: 100,
    category: 'Еда',
    description: null,
    date: today,
    reply_hint: '',
    ...overrides,
  }) as VoiceInterpretResult;

describe('extractJsonObject', () => {
  it('finds JSON inside a markdown fence or text', () => {
    expect(JSON.parse(extractJsonObject('```json\n{"a":1}\n```'))).toEqual({
      a: 1,
    });
    expect(JSON.parse(extractJsonObject('Ответ: {"a":2} готово'))).toEqual({
      a: 2,
    });
  });
});

describe('safeParseInterpret', () => {
  it('reads several operations from one phrase', () => {
    const batch = safeParseInterpret(
      JSON.stringify({
        operations: [
          {
            intent: 'create_expense',
            confidence: 0.9,
            amount: 1000,
            category: 'Еда',
          },
          {
            intent: 'create_expense',
            confidence: 0.8,
            amount: '500,5',
            category: 'Кофе',
          },
        ],
        batch_reply_hint: 'Записал',
      }),
      today,
    );

    expect(batch.items.map((i) => i.amount)).toEqual([1000, 500.5]);
    expect(batch.batch_reply_hint).toBe('Записал');
  });

  it('accepts a bare array of operations', () => {
    const batch = safeParseInterpret(
      '[{"intent":"wallet_balance","confidence":1}]',
      today,
    );
    expect(batch.items[0].intent).toBe('wallet_balance');
  });

  it('turns unknown intents and broken answers into unknown', () => {
    expect(
      safeParseInterpret('{"operations":[{"intent":"hack_bank"}]}', today)
        .items[0].intent,
    ).toBe('unknown');
    expect(safeParseInterpret('not json', today).items[0].intent).toBe(
      'unknown',
    );
    expect(safeParseInterpret('{"operations":[]}', today).items[0].intent).toBe(
      'unknown',
    );
  });

  it('does not turn objects from the model into text', () => {
    const [item] = safeParseInterpret(
      '{"operations":[{"intent":"create_expense","confidence":0.9,"amount":5,"category":{"x":1}}]}',
      today,
    ).items;
    expect(item.category).toBeNull();
  });

  it('defaults the date to today', () => {
    const [item] = safeParseInterpret(
      '{"operations":[{"intent":"create_expense","confidence":0.9,"amount":5,"category":"a"}]}',
      today,
    ).items;
    expect(item.date).toBe(today);
  });
});

describe('isVoiceItemExecutable', () => {
  it('requires a positive amount for money operations', () => {
    expect(isVoiceItemExecutable(expense())).toBe(true);
    expect(isVoiceItemExecutable(expense({ amount: null }))).toBe(false);
    expect(isVoiceItemExecutable(expense({ amount: -5 }))).toBe(false);
  });

  it('skips low confidence and unknown intents', () => {
    expect(isVoiceItemExecutable(expense({ confidence: 0.1 }))).toBe(false);
    expect(isVoiceItemExecutable(expense({ intent: 'unknown' }))).toBe(false);
  });

  it('requires the fields of each intent', () => {
    expect(
      isVoiceItemExecutable(
        expense({ intent: 'goal_create', amount: 10, goal_name: 'Авто' }),
      ),
    ).toBe(true);
    expect(
      isVoiceItemExecutable(
        expense({ intent: 'budget_create', amount: 10, budget_period: null }),
      ),
    ).toBe(false);
  });
});

describe('applyStructuralConfidenceFloor', () => {
  it('raises confidence for a complete actionable operation', () => {
    const raised = applyStructuralConfidenceFloor(
      expense({ confidence: 0.3 }),
      'еда 1000',
    );
    expect(raised.confidence).toBeGreaterThan(0.3);
  });

  it('leaves operations without an amount alone', () => {
    expect(
      applyStructuralConfidenceFloor(
        expense({ confidence: 0.3, amount: null }),
        'еда',
      ).confidence,
    ).toBe(0.3);
  });
});
