import React, { useState, useEffect } from 'react';
import { BudgetMap, MultiScopeBudget, ExpenseCategory, Portfolio } from '../types';
import Button from './Button';
import { X, AlertTriangle, Globe, Layout } from 'lucide-react';

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
  const [currentScope, setCurrentScope] = useState<'global' | string>(activePortfolioId || 'global');
  const [localBudgets, setLocalBudgets] = useState<MultiScopeBudget>({ ...budgets });

  useEffect(() => {
    if (isOpen) {
      setLocalBudgets({ ...budgets });
      setCurrentScope(activePortfolioId || 'global');
    }
  }, [isOpen, budgets, activePortfolioId]);

  const activeMap = currentScope === 'global'
    ? localBudgets.global
    : localBudgets.portfolios[currentScope] || {} as BudgetMap;

  const handleChange = (category: ExpenseCategory, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalBudgets(prev => {
      const next = { ...prev };
      if (currentScope === 'global') {
        next.global = { ...next.global, [category]: numValue };
      } else {
        next.portfolios = {
          ...next.portfolios,
          [currentScope]: { ...(next.portfolios[currentScope] || {}), [category]: numValue }
        };
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(localBudgets);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity"
          aria-hidden="true"
          onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-indigo-500" />
                Set Monthly Budgets (RM)
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              <p className="text-sm text-slate-500">
                Define your spending limits. Set to 0 to disable warnings.
              </p>

              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  onClick={() => setCurrentScope('global')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${currentScope === 'global' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Global
                </button>
                <div className="w-px h-4 bg-slate-200" />
                <select
                  value={currentScope === 'global' ? '' : currentScope}
                  onChange={(e) => e.target.value && setCurrentScope(e.target.value)}
                  className={`flex-1 bg-transparent border-none text-xs font-bold focus:ring-0 cursor-pointer ${currentScope !== 'global' ? 'text-indigo-600' : 'text-slate-500'}`}
                >
                  <option value="" disabled>Select Page...</option>
                  {portfolios.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {currentScope !== 'global' && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-tight">
                    This budget only applies to <strong>{portfolios.find(p => p.id === currentScope)?.name}</strong>. If blank, the global budget will be used.
                  </p>
                </div>
              )}
            </div>

            <form id="budgetForm" onSubmit={handleSubmit} className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {Object.values(ExpenseCategory).map((cat) => (
                <div key={cat} className="flex items-center justify-between gap-4">
                  <label className="block text-sm font-medium text-slate-700 w-1/2">
                    {cat}
                  </label>
                  <div className="relative rounded-md shadow-sm w-1/2">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <span className="text-slate-400 sm:text-sm">RM</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      className="block w-full rounded-md border-slate-200 pl-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-slate-900"
                      value={activeMap[cat] || ''}
                      onChange={(e) => handleChange(cat, e.target.value)}
                      placeholder={currentScope === 'global' ? 'No Limit' : 'Use Global'}
                    />
                  </div>
                </div>
              ))}
            </form>
          </div>
          <div className="bg-slate-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <Button type="submit" form="budgetForm" className="w-full sm:w-auto sm:ml-3">
              Save Budgets
            </Button>
            <Button variant="secondary" onClick={onClose} className="mt-3 w-full sm:mt-0 sm:ml-3 sm:w-auto">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BudgetModal;