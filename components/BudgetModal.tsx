import React, { useState, useEffect } from 'react';
import { BudgetMap, MultiScopeBudget, ExpenseCategory, Portfolio, BudgetProfile } from '../types';
import Button from './Button';
import { X, AlertTriangle, Globe, Layout, Plus, Trash2, Check, ChevronDown, List } from 'lucide-react';

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
  const [localBudgets, setLocalBudgets] = useState<MultiScopeBudget>({ ...budgets });
  const [selectedProfileId, setSelectedProfileId] = useState<string>('global');
  const [view, setView] = useState<'configure' | 'assignments'>('configure');

  useEffect(() => {
    if (isOpen) {
      setLocalBudgets({ ...budgets });
      // Initially focus on the profile assigned to the active portfolio
      const profileId = activePortfolioId ? (budgets.assignments[activePortfolioId] || 'global') : 'global';
      setSelectedProfileId(profileId);
      setView('configure');
    }
  }, [isOpen, budgets, activePortfolioId]);

  const selectedProfile = localBudgets.profiles.find(p => p.id === selectedProfileId) || localBudgets.profiles[0];
  const activeMap = selectedProfile?.map || {} as BudgetMap;

  const handleCreateProfile = () => {
    const name = prompt('Enter a name for the new budget profile:');
    if (!name) return;
    const newId = `prof_${Date.now()}`;
    const newProfile: BudgetProfile = {
      id: newId,
      name,
      map: { ...localBudgets.profiles[0].map } // Copy global default
    };
    setLocalBudgets(prev => ({
      ...prev,
      profiles: [...prev.profiles, newProfile]
    }));
    setSelectedProfileId(newId);
  };

  const handleDeleteProfile = (id: string) => {
    if (id === 'global') return;
    if (!confirm('Are you sure you want to delete this budget profile? Pages using it will revert to Global Default.')) return;

    setLocalBudgets(prev => {
      const nextAssignments = { ...prev.assignments };
      Object.keys(nextAssignments).forEach(pId => {
        if (nextAssignments[pId] === id) delete nextAssignments[pId];
      });
      return {
        ...prev,
        profiles: prev.profiles.filter(p => p.id !== id),
        assignments: nextAssignments
      };
    });
    setSelectedProfileId('global');
  };

  const togglePortfolioAssignment = (portfolioId: string) => {
    setLocalBudgets(prev => {
      const nextAssignments = { ...prev.assignments };
      if (selectedProfileId === 'global') {
        // Unassign from any custom profile to revert to global
        delete nextAssignments[portfolioId];
      } else {
        // Assign to current custom profile
        nextAssignments[portfolioId] = selectedProfileId;
      }
      return { ...prev, assignments: nextAssignments };
    });
  };

  const handleChange = (category: ExpenseCategory, value: string) => {
    const numValue = parseFloat(value) || 0;
    setLocalBudgets(prev => ({
      ...prev,
      profiles: prev.profiles.map(p =>
        p.id === selectedProfileId
          ? { ...p, map: { ...p.map, [category]: numValue } }
          : p
      )
    }));
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
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 transition-opacity" onClick={onClose} />
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border border-slate-200">
          <div className="bg-white px-6 pt-6 pb-6 border-b border-slate-100 flex justify-between items-center">
            <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-indigo-500" />
              Budget Management
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setView('configure')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${view === 'configure' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Configure
              </button>
              <button
                onClick={() => setView('assignments')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${view === 'assignments' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                View Mapping
              </button>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-white px-6 py-6 h-[65vh] overflow-hidden flex flex-col">
            {view === 'configure' ? (
              <div className="flex h-full gap-6">
                {/* Left Side: Profile Selection & Portfolio Assignment */}
                <div className="w-1/3 flex flex-col gap-4 border-r border-slate-100 pr-6">
                  <div>
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Budget Profile
                    </label>
                    <div className="flex flex-col gap-2">
                      <div className="relative">
                        <select
                          value={selectedProfileId}
                          onChange={(e) => {
                            if (e.target.value === 'new') {
                              handleCreateProfile();
                            } else {
                              setSelectedProfileId(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-50 border-slate-200 rounded-xl text-sm font-bold text-indigo-700 focus:ring-indigo-500 py-2.5 pr-10 appearance-none"
                        >
                          {localBudgets.profiles.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                          <option value="new">+ Create New Profile...</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                      {selectedProfileId !== 'global' && (
                        <button
                          onClick={() => handleDeleteProfile(selectedProfileId)}
                          className="text-[10px] text-red-500 font-bold flex items-center gap-1 hover:text-red-700 ml-1"
                        >
                          <Trash2 className="w-3 h-3" /> Delete Profile
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                      Applied to Pages
                    </label>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-1">
                      {portfolios.map(p => {
                        const isAssigned = (selectedProfileId === 'global' && !localBudgets.assignments[p.id]) || (localBudgets.assignments[p.id] === selectedProfileId);
                        return (
                          <button
                            key={p.id}
                            onClick={() => togglePortfolioAssignment(p.id)}
                            className={`flex items-center gap-2 p-2 rounded-lg text-left transition-all ${isAssigned ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                          >
                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAssigned ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>
                              {isAssigned && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-xs font-semibold truncate">{p.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Side: Category Limits */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">
                    Spending Limits for <span className="text-indigo-600">"{selectedProfile?.name}"</span>
                  </label>
                  <form id="budgetForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-4 custom-scrollbar space-y-3">
                    {Object.values(ExpenseCategory).map((cat) => (
                      <div key={cat} className="group flex items-center justify-between gap-4 p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                        <label className="text-sm font-semibold text-slate-700 w-1/2 group-hover:text-slate-900 transition-colors">
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
                            value={activeMap[cat] || ''}
                            onChange={(e) => handleChange(cat, e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    ))}
                  </form>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-y-2">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Page Name</th>
                      <th className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Applied Budget Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolios.map(p => {
                      const profId = localBudgets.assignments[p.id] || 'global';
                      const prof = localBudgets.profiles.find(bp => bp.id === profId);
                      return (
                        <tr key={p.id} className="bg-slate-50 rounded-xl overflow-hidden group hover:bg-slate-100 transition-all">
                          <td className="px-4 py-3 text-sm font-bold text-slate-800 rounded-l-xl">
                            <div className="flex items-center gap-2">
                              <Layout className="w-4 h-4 text-slate-400" />
                              {p.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm rounded-r-xl">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${profId === 'global' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                              {prof?.name || 'Unknown'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-50 px-6 py-4 sm:flex sm:flex-row-reverse sm:gap-3 rounded-b-2xl border-t border-slate-100">
            <Button type="submit" form="budgetForm" className="w-full sm:w-auto shadow-lg shadow-indigo-100">
              Save All Changes
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
