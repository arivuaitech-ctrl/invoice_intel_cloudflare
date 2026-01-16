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
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [localMap, setLocalMap] = useState<BudgetMap>({} as BudgetMap);

  useEffect(() => {
    if (isOpen) {
      // Initially select the active portfolio or global
      const initial = activePortfolioId ? [activePortfolioId] : ['global'];
      setSelectedScopes(initial);

      // Load the values from the first selected scope
      const scope = initial[0];
      const map = scope === 'global' ? budgets.global : (budgets.portfolios[scope] || budgets.global);
      setLocalMap({ ...map });
      setShowDropdown(false);
    }
  }, [isOpen, budgets, activePortfolioId]);

  const toggleScope = (id: string) => {
    setSelectedScopes(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleChange = (category: ExpenseCategory, value: string) => {
    setLocalMap(prev => ({
      ...prev,
      [category]: parseFloat(value) || 0
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newBudgets = { ...budgets, portfolios: { ...budgets.portfolios } };

    selectedScopes.forEach(scope => {
      if (scope === 'global') {
        newBudgets.global = { ...localMap };
      } else {
        newBudgets.portfolios[scope] = { ...localMap };
      }
    });

    onSave(newBudgets);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-slate-200">
          <div className="bg-white px-6 py-6 flex flex-col gap-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-6 h-6 text-indigo-500" />
                Configure Budget
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Multiselect Dropdown */}
            <div className="relative">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                Apply settings to:
              </label>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-between hover:bg-slate-100 transition-all text-sm font-bold text-slate-700"
              >
                <div className="flex items-center gap-2 truncate">
                  {selectedScopes.length === 0 ? (
                    <span className="text-slate-400">Select pages...</span>
                  ) : selectedScopes.length === (portfolios.length + 1) ? (
                    <span className="text-indigo-600">All Pages & Global</span>
                  ) : (
                    <div className="flex gap-1">
                      {selectedScopes.map(s => (
                        <span key={s} className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px]">
                          {s === 'global' ? 'Global' : portfolios.find(p => p.id === s)?.name || 'Page'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-10 py-2 max-h-60 overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => toggleScope('global')}
                    className="w-full px-4 py-2 hover:bg-slate-50 flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-slate-400" />
                      <span className="text-sm font-semibold text-slate-700">Global Default</span>
                    </div>
                    {selectedScopes.includes('global') && <Check className="w-4 h-4 text-indigo-600" />}
                  </button>
                  <div className="h-px bg-slate-100 my-1 mx-2" />
                  {portfolios.map(p => (
                    <button
                      key={p.id}
                      onClick={() => toggleScope(p.id)}
                      className="w-full px-4 py-2 hover:bg-slate-50 flex items-center justify-between group"
                    >
                      <span className="text-sm font-semibold text-slate-600">{p.name}</span>
                      {selectedScopes.includes(p.id) && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form id="budgetForm" onSubmit={handleSubmit} className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
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
            <Button type="submit" form="budgetForm" className="w-full sm:w-auto shadow-lg shadow-indigo-100" disabled={selectedScopes.length === 0}>
              Apply to {selectedScopes.length} Scopes
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
