import { useState, useEffect } from 'react';
import { Budget } from '../types';
import api from '../services/api';
import CreateBudgetModal from '../components/CreateBudgetModal';

const BudgetsView = () => {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchBudgets = async () => {
    try {
      const response = await api.get('/budgets?userId=12345'); // TODO: replace with real user ID
      setBudgets(response.data);
    } catch (error) {
      console.error('Failed to fetch budgets', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudgets();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-white">Budgets</h1>
        <button onClick={() => setIsCreateModalOpen(true)} className="bg-[color:var(--primary-color)] text-white px-4 py-2 rounded-lg">New Budget</button>
      </div>

      {budgets.map(budget => (
        <div key={budget._id} className="bg-[color:var(--card-bg-color)] border border-[color:var(--card-border-color)] p-4 rounded-2xl mb-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-white">{budget.name}</h2>
            <p className="text-lg font-bold text-white">{budget.amount} ₽</p>
          </div>
          <div className="mt-2">
            <div className="w-full bg-black/20 rounded-full h-2.5">
              <div
                className="h-full rounded-full bg-[color:var(--primary-color)]"
                style={{ width: `50%` }} // TODO: calculate progress
              ></div>
            </div>
          </div>
        </div>
      ))}

      <CreateBudgetModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSuccess={() => {
          fetchBudgets();
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
};

export default BudgetsView;
