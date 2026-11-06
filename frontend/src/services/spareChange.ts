const TRANSACTIONS_KEY = 'spareChangeTransactions';

export interface Transaction {
  id: string;
  amount: number;
  createdAt: Date;
}

export const addTransaction = (): Transaction => {
  const transactions = getTransactions();
  const newTransaction: Transaction = {
    id: crypto.randomUUID(),
    amount: Math.random() * 490 + 10, // Random amount between 10 and 500
    createdAt: new Date(),
  };
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify([...transactions, newTransaction]));
  return newTransaction;
};

export const getTransactions = (): Transaction[] => {
  const transactions = localStorage.getItem(TRANSACTIONS_KEY);
  return transactions ? JSON.parse(transactions) : [];
};

export const calculateSpareChange = (transactions: Transaction[]): number => {
  return transactions.reduce((total, transaction) => {
    const roundedUp = Math.ceil(transaction.amount / 10) * 10;
    const spareChange = roundedUp - transaction.amount;
    return total + spareChange;
  }, 0);
};

export const clearTransactions = (): void => {
  localStorage.removeItem(TRANSACTIONS_KEY);
};
