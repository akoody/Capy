import { useState } from 'react';
import api from '../services/api';

interface CreateBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateBudgetModal = ({ isOpen, onClose, onSuccess }: CreateBudgetModalProps) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [period, setPeriod] = useState('monthly');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !amount || !category || !period) {
      setError('Please fill in all fields.');
      return;
    }

    try {
      await api.post('/budgets', {
        name,
        amount: Number(amount),
        category,
        period,
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create budget', err);
      setError('Failed to create budget.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 backdrop-blur-xl z-50" onClick={onClose}>
      <div className="bg-[color:var(--card-bg-color)] rounded-2xl p-8 w-full max-w-sm border border-[color:var(--card-border-color)] shadow-2xl text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-2xl font-bold mb-6 text-white">Create Budget</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="my-4">
            <label htmlFor="name" className="block text-sm font-medium text-left mb-1">Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
              required
            />
          </div>

          <div className="my-4">
            <label htmlFor="amount" className="block text-sm font-medium text-left mb-1">Amount</label>
            <input
              type="number"
              id="amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
              required
            />
          </div>

          <div className="my-4">
            <label htmlFor="category" className="block text-sm font-medium text-left mb-1">Category</label>
            <input
              type="text"
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
              required
            />
          </div>

          <div className="my-4">
            <label htmlFor="period" className="block text-sm font-medium text-left mb-1">Period</label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 block w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-color)] sm:text-sm transition-all"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

          <div className="flex justify-end space-x-3 mt-5">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-black/20 text-gray-300 rounded-lg hover:bg-black/30 transition-colors">Cancel</button>
            <button type="submit" className="px-5 py-2.5 bg-[color:var(--primary-color)] text-white rounded-lg hover:opacity-90 transition-opacity shadow-lg">Create</button>
          </div>
        </form>

        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
};

export default CreateBudgetModal;
