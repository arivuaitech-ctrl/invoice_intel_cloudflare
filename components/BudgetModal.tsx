import React, { useState, useEffect } from 'react';
import { BudgetMap, MultiScopeBudget, ExpenseCategory, Portfolio } from '../types';
import Button from './Button';
import { X, AlertTriangle, Check, ChevronDown, Globe } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: MultiScopeBudget;
  onSave: (budgets: MultiScopeBudget) => void;
  portfolios: Portfolio[];
  activePortfolioId: string | null;
}

const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  budgets,
  onSave,
  portfolios,
  activePortfolioId
}) => {
  const [localMap, setLocalMap] = useState<BudgetMap>({} as BudgetMap);

  useEffect(() => {
    if (isOpen && activePortfolioId) {
      const map = budgets.portfolios[activePortfolioId];
      if (map) {
        setLocalMap({ ...map });
      } else {
        // Initialize with 0s if no budget exists
        const emptyMap = Object.values(ExpenseCategory).reduce((acc, cat) => {
          acc[cat as ExpenseCategory] = 0;
          return acc;
        }, {} as BudgetMap);
        setLocalMap(emptyMap);
      }
    }
  }, [isOpen, budgets, activePortfolioId]);

  const handleChange = (category: ExpenseCategory, value: string) => {
    setLocalMap(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePortfolioId) return;

    const newBudgets = {
      ...budgets,
      portfolios: {
        ...budgets.portfolios,
        [activePortfolioId]: { ...localMap }
      }
    };

    onSave(newBudgets);
    onClose();
  };

  const activePortfolio = portfolios.find(p => p.id === activePortfolioId);

  if (!isOpen || !activePortfolioId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-slate-200">
          <div className="bg-white px-6 py-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-indigo-500" />
                  Budget for {activePortfolio?.name || 'Page'}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">Set monthly spending limits for this page.</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form id="budgetForm" onSubmit={handleSubmit} className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {Object.values(ExpenseCategory).map((cat) => (
                <div key={cat} className="flex items-center justify-between gap-4 p-2 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-all">
                  <label className="text-sm font-semibold text-slate-700 w-1/2">
                    {cat}
                  </label>
                  <div className="relative rounded-xl shadow-sm w-1/2">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-400 text-xs font-bold">RM</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className="block w-full rounded-xl border-slate-200 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900 font-bold"
                      value={localMap[cat] || ''}
                      onChange={(e) => handleChange(cat, e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </form>
          </div>

          <div className="bg-slate-50 px-6 py-4 sm:flex sm:flex-row-reverse sm:gap-3 rounded-b-2xl border-t border-slate-100">
            <Button type="submit" form="budgetForm" className="w-full sm:w-auto shadow-lg shadow-indigo-100">
              Save Budget
            </Button>
            <Button variant="secondary" onClick={onClose} className="mt-2 w-full sm:mt-0 sm:w-auto">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetModal;
