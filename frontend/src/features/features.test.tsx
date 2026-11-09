/** Экраны целиком: компоненты, разнесённые по файлам, работают вместе с API. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import api from '../services/api';
import JournalView from './journal/JournalView';
import TasksView from './tasks/TasksView';
import TransactionsView from './transactions/TransactionsView';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock('../context/CurrencyContext', () => ({
  useCurrency: () => ({ currency: 'USD', userId: 'u1' }),
}));

const mocked = api as unknown as Record<
  'get' | 'post' | 'patch' | 'delete',
  Mock
>;
const respondWith = (routes: Record<string, unknown>) =>
  mocked.get.mockImplementation((url: string) =>
    Promise.resolve({ data: routes[url] ?? [] }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocked.post.mockResolvedValue({ data: {} });
  mocked.patch.mockResolvedValue({ data: {} });
  mocked.delete.mockResolvedValue({ data: {} });
});

describe('TasksView', () => {
  const task = {
    _id: 't1',
    title: 'Pay rent',
    status: 'open',
    priority: 'high',
    reminders: [],
    createdAt: '',
    updatedAt: '',
  };

  beforeEach(() => respondWith({ '/tasks?status=open': [task] }));

  it('creates a task from the form', async () => {
    render(<TasksView userId="u1" />);
    await screen.findByText('Pay rent');

    fireEvent.click(screen.getByRole('button', { name: 'task_add' }));
    fireEvent.change(screen.getByPlaceholderText('task_title_placeholder'), {
      target: { value: ' Buy milk ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mocked.post).toHaveBeenCalledWith('/tasks', {
        title: 'Buy milk',
        description: undefined,
        priority: 'medium',
        dueAt: undefined,
        reminderFireTimes: undefined,
      }),
    );
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('task_title_placeholder')).toBeNull(),
    );
  });

  it('prefills the form when editing', async () => {
    render(<TasksView userId="u1" />);
    await screen.findByText('Pay rent');

    fireEvent.click(screen.getByRole('button', { name: 'task_edit' }));

    expect(
      (screen.getByPlaceholderText('task_title_placeholder') as HTMLInputElement)
        .value,
    ).toBe('Pay rent');
  });

  it('completes a task and reloads the list', async () => {
    render(<TasksView userId="u1" />);
    await screen.findByText('Pay rent');
    const loads = mocked.get.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'task_complete' }));

    await waitFor(() =>
      expect(mocked.post).toHaveBeenCalledWith('/tasks/t1/complete'),
    );
    await waitFor(() =>
      expect(mocked.get.mock.calls.length).toBeGreaterThan(loads),
    );
  });
});

describe('JournalView', () => {
  const entry = (id: string, content: string, tags: string[]) => ({
    _id: id,
    content,
    tags,
    date: '2026-01-02T10:00:00.000Z',
    createdAt: '2026-01-02T10:00:00.000Z',
    user: 'u1',
  });

  beforeEach(() =>
    respondWith({
      '/journal': [entry('a', 'Coffee', ['food']), entry('b', 'Rent', ['home'])],
    }),
  );

  it('filters by tag', async () => {
    render(<JournalView />);
    await screen.findByText('Coffee');

    fireEvent.click(screen.getByRole('button', { name: '#food' }));

    expect(screen.getByText('Coffee')).toBeTruthy();
    expect(screen.queryByText('Rent')).toBeNull();
  });

  it('deletes an entry after confirmation', async () => {
    const onEntriesUpdate = vi.fn();
    render(<JournalView onEntriesUpdate={onEntriesUpdate} />);
    await screen.findByText('Coffee');

    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[0]);
    const buttons = screen.getAllByRole('button', { name: 'delete' });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(mocked.delete).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(onEntriesUpdate.mock.lastCall?.[0]).toHaveLength(1),
    );
  });

  it('opens an existing entry for editing and saves it', async () => {
    render(<JournalView />);
    fireEvent.click(await screen.findByText('Coffee'));

    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(mocked.patch).toHaveBeenCalledWith(
        expect.stringMatching(/^\/journal\/[ab]$/),
        expect.objectContaining({ content: 'Coffee', tags: ['food'] }),
      ),
    );
  });
});

describe('TransactionsView', () => {
  const now = new Date().toISOString();
  const transaction = {
    _id: 'x1',
    amount: 40,
    type: 'expense',
    category: 'Food',
    date: now,
    createdAt: now,
    walletEffect: 'debit',
  };

  beforeEach(() =>
    respondWith({
      '/transactions': [
        transaction,
        { ...transaction, _id: 'x2', type: 'deposit', category: 'Piggy' },
      ],
    }),
  );

  it('hides wallet transfers from the feed', async () => {
    render(<TransactionsView />);
    await screen.findAllByText('Food');
    expect(screen.queryByText('Piggy')).toBeNull();
  });

  it('refreshes the wallet after deleting a linked transaction', async () => {
    const onWallet = vi.fn();
    window.addEventListener('walletUpdated', onWallet);
    render(<TransactionsView />);
    await screen.findAllByText('Food');

    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[0]);
    const buttons = screen.getAllByRole('button', { name: 'delete' });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(mocked.delete).toHaveBeenCalledWith('/transactions/x1'),
    );
    await waitFor(() => expect(onWallet).toHaveBeenCalledTimes(1));
    window.removeEventListener('walletUpdated', onWallet);
  });

  it('shows the analysis result', async () => {
    mocked.post.mockResolvedValue({ data: { analysis: 'Spend less' } });
    render(<TransactionsView />);
    await screen.findAllByText('Food');

    fireEvent.click(
      screen.getByRole('button', { name: 'analyze_transactions' }),
    );

    await screen.findByText('Spend less');
  });
});
