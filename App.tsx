
import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import {
  Search, Download, Trash2, Plus, Edit2, AlertTriangle, Eye,
  PieChart as PieChartIcon, List, Settings, LogOut, Sparkles, Crown, CreditCard,
  RefreshCw, CheckCircle2, X, Loader2, ShieldAlert, ImageIcon, HelpCircle, User
} from 'lucide-react';

import { ExpenseItem, Stats, SortField, SortOrder, ExpenseCategory, BudgetMap, MultiScopeBudget, UserProfile, Portfolio } from './types';
import { db } from './services/db';
import { extractInvoiceData, fileToGenerativePart } from './services/geminiService';
import { userService } from './services/userService';
import { stripeService } from './services/stripeService';
import { supabase } from './services/supabaseClient';

import FileUpload from './components/FileUpload';
import Button from './components/Button';
import ExpenseModal from './components/ExpenseModal';
import AnalyticsView from './components/AnalyticsView';
import BudgetModal from './components/BudgetModal';
import LoginPage from './components/LoginPage';
import PricingModal from './components/PricingModal';
import ImageViewer from './components/ImageViewer';
import ProfileModal from './components/ProfileModal';
import ConsentModal from './components/ConsentModal';
import LegalModal from './components/LegalModal';

const COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#a855f7', '#64748b',
  '#fb7185', '#38bdf8', '#fbbf24', '#34d399', '#818cf8'
];

type ViewType = 'expenses' | 'analytics';

const formatDate = (rawDate: string) => {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (regex.test(rawDate)) return rawDate;
  const d = new Date(rawDate);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return rawDate;
};

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [budgets, setBudgets] = useState<MultiScopeBudget>({ portfolios: {}, defaultCurrency: 'USD' });
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [view, setView] = useState<ViewType>('expenses');
  const [progressStatus, setProgressStatus] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string | null>(null);
  const [isPortfolioLoading, setIsPortfolioLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ExpenseItem | undefined>(undefined);
  const [viewingImage, setViewingImage] = useState<{ url: string, title: string } | null>(null);
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean, type: 'privacy' | 'terms' }>({ isOpen: false, type: 'privacy' });

  const pollIntervalRef = useRef<number | null>(null);

  // The API key is now handled server-side in Cloudflare Functions
  const isGeminiKeyMissing = false;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');

    if (payment === 'success') {
      setPaymentStatus('success');
      setIsSyncing(true);
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 5000);
    } else if (payment === 'cancelled') {
      setPaymentStatus('cancelled');
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 3000);
    }

    const handleOpenPricing = () => setIsPricingModalOpen(true);
    window.addEventListener('open-pricing', handleOpenPricing);
    return () => window.removeEventListener('open-pricing', handleOpenPricing);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          const profile = await userService.upsertProfile(session.user);
          setUser(profile);

          const data = await db.getAll(session.user.id);
          setExpenses(data);

          const savedBudgets = db.getBudgets();

          // Fetch Portfolios
          setIsPortfolioLoading(true);
          let portfolioData = await db.getPortfolios(session.user.id);

          if (portfolioData.length === 0) {
            const defaultPortfolio = await db.addPortfolio('General', session.user.id);
            portfolioData = [defaultPortfolio];
          }

          setPortfolios(portfolioData);
          const firstId = portfolioData[0]?.id;

          if (firstId) {
            setActivePortfolioId(firstId);

            // Fix: If Page 1 has no budget, but we have a legacy global budget, migrate it
            const legacyGlobal = (savedBudgets as any)._legacyGlobal;
            if (legacyGlobal && !savedBudgets.portfolios[firstId]) {
              console.log("[App] Migrating legacy global budget to first portfolio:", firstId);
              savedBudgets.portfolios[firstId] = legacyGlobal;
              db.saveBudgets(savedBudgets);
            }
          }

          setBudgets(savedBudgets);
          setIsPortfolioLoading(false);
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter(item => {
        const vendor = item.vendorName || '';
        const summary = item.summary || '';
        const matchesSearch = vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          summary.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

        // Match active portfolio OR legacy items showing in the first portfolio
        const isFirstPortfolio = portfolios.length > 0 && activePortfolioId === portfolios[0].id;
        const matchesPortfolio = item.portfolioId === activePortfolioId || (isFirstPortfolio && !item.portfolioId);

        return matchesSearch && matchesCategory && matchesPortfolio;
      })
      .sort((a, b) => {
        let valA = a[sortField] as any;
        let valB = b[sortField] as any;
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [expenses, searchTerm, selectedCategory, sortField, sortOrder, activePortfolioId, portfolios]);

  const stats = useMemo<Stats>(() => {
    const totalAmount = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const catMap = new Map<string, number>();
    filteredExpenses.forEach(item => {
      catMap.set(item.category, (catMap.get(item.category) || 0) + (Number(item.amount) || 0));
    });
    const categoryBreakdown = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));
    categoryBreakdown.sort((a, b) => b.value - a.value);
    return { totalAmount, count: filteredExpenses.length, categoryBreakdown };
  }, [filteredExpenses]);

  async function refreshExpenses() {
    if (user) {
      const data = await db.getAll(user.id);
      setExpenses(data);
    }
  }

  function checkBudgetWarning(category: ExpenseCategory, amount: number) {
    if (!activePortfolioId) return;

    const activeBudgetMap = budgets.portfolios[activePortfolioId];
    if (!activeBudgetMap) return;

    const limit = activeBudgetMap[category];
    if (limit && limit > 0) {
      const currentTotal = expenses
        .filter(e => e.category === category && (e.portfolioId === activePortfolioId || (!e.portfolioId && portfolios[0]?.id === activePortfolioId)))
        .reduce((sum, e) => sum + e.amount, 0);

      if (currentTotal + amount > limit) {
        setTimeout(() => {
          alert(`⚠️ Budget Alert: Spending on ${category} exceeds your ${budgets.defaultCurrency} ${limit} limit in ${activePortfolioId && activePortfolioId !== portfolios[0]?.id ? 'this page' : 'General'}.`);
        }, 500);
      }
    }
  }

  async function handleFilesSelect(files: (File | Blob)[]) {
    if (!user) return;
    // AI Extraction is handled server-side; availability is verified at runtime.
    const status = userService.canUpload(user, files.length);
    if (!status.allowed) {
      setIsPricingModalOpen(true);
      return;
    }

    setIsProcessing(true);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileName = file instanceof File ? file.name : `captured-receipt-${Date.now()}.jpg`;
      setProgressStatus(`Analyzing ${i + 1}/${files.length}...`);

      try {
        const [data, imageInfo] = await Promise.all([
          extractInvoiceData(file),
          fileToGenerativePart(file)
        ]);

        const newExpense: ExpenseItem = {
          id: crypto.randomUUID(),
          vendorName: data.vendorName || 'Unknown Vendor',
          date: formatDate(data.date),
          amount: Number(data.amount) || 0,
          currency: budgets.defaultCurrency, // ALWAYS use global currency
          category: data.category as ExpenseCategory || ExpenseCategory.OTHERS,
          summary: data.summary || '',
          createdAt: Date.now(),
          fileName: fileName,
          imageData: `data:${imageInfo.mimeType};base64,${imageInfo.data}`,
          portfolioId: activePortfolioId || undefined
        };
        await db.add(newExpense, user.id);
        checkBudgetWarning(newExpense.category, newExpense.amount);
        successCount++;
      } catch (error: any) {
        console.error(`Extraction failed:`, error);
      }
    }

    if (successCount > 0) {
      const updatedUser = await userService.recordUsage(user, successCount);
      setUser(updatedUser);
      await refreshExpenses();
    }
    setIsProcessing(false);
    setProgressStatus('');
  }

  async function handleSaveExpense(item: ExpenseItem) {
    if (!user) return;
    const oldExpenses = [...expenses];
    const cleanedItem = {
      ...item,
      date: formatDate(item.date),
      portfolioId: item.portfolioId || activePortfolioId || undefined
    };

    if (expenses.some(e => e.id === item.id)) {
      setExpenses(prev => prev.map(e => e.id === item.id ? cleanedItem : e));
    } else {
      setExpenses(prev => [cleanedItem, ...prev]);
    }

    try {
      if (oldExpenses.some(e => e.id === item.id)) {
        await db.update(cleanedItem, user.id);
      } else {
        await db.add(cleanedItem, user.id);
        checkBudgetWarning(item.category, item.amount);
      }
      await refreshExpenses();
    } catch (e: any) {
      console.error("Save failed:", e);
      setExpenses(oldExpenses);
      alert("Failed to save.");
    }
  }

  function handleSaveBudgets(newBudgets: MultiScopeBudget) {
    db.saveBudgets(newBudgets);
    setBudgets(newBudgets);
  }

  const handleAcceptConsent = async () => {
    if (!user) return;
    try {
      const updatedUser = await userService.updateConsent(user.id);
      setUser(updatedUser);
    } catch (err) {
      console.error("Error updating consent:", err);
    }
  };

  async function handleDelete(id: string) {
    if (!user) return;
    if (window.confirm("Are you sure you want to delete this expense?")) {
      const oldExpenses = [...expenses];
      setExpenses(prev => prev.filter(e => e.id !== id));
      try {
        await db.delete(id, user.id);
      } catch (err) {
        console.error("Delete failed:", err);
        setExpenses(oldExpenses);
      }
    }
  }

  async function handleExport() {
    const dataToExport = filteredExpenses.map(({ id, createdAt, imageData, ...rest }) => ({
      ...rest,
      date_created: new Date(createdAt).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");
    XLSX.writeFile(wb, `InvoiceIntel_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // --- Portfolio Handlers ---
  async function handleCreatePortfolio() {
    if (!user) return;
    if (portfolios.length >= 10) {
      alert("Maximum 10 pages allowed. Please delete an existing page first.");
      return;
    }
    const name = window.prompt("Enter page name:");
    if (!name) return;

    try {
      const newPortfolio = await db.addPortfolio(name, user.id);
      setPortfolios(prev => [...prev, newPortfolio]);
      setActivePortfolioId(newPortfolio.id);
    } catch (err) {
      console.error("Failed to create page:", err);
      alert("Failed to create page.");
    }
  }

  async function handleRenamePortfolio(id: string, currentName: string) {
    const name = window.prompt("Rename page:", currentName);
    if (!name || name === currentName) return;

    try {
      await db.updatePortfolio(id, name);
      setPortfolios(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    } catch (err) {
      console.error("Failed to rename page:", err);
      alert("Failed to rename page.");
    }
  }

  async function handleDeletePortfolio(id: string) {
    if (portfolios.length <= 1) {
      alert("You must have at least one page.");
      return;
    }
    if (window.confirm("Are you sure? This will delete all expenses in this page!")) {
      try {
        await db.deletePortfolio(id, user!.id);
        const updatedPortfolios = portfolios.filter(p => p.id !== id);
        setPortfolios(updatedPortfolios);
        setExpenses(prev => prev.filter(e => e.portfolioId !== id));
        if (activePortfolioId === id) {
          setActivePortfolioId(updatedPortfolios[0].id);
        }
      } catch (err) {
        console.error("Failed to delete page:", err);
        alert("Failed to delete page.");
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-slate-500 text-sm font-medium animate-pulse">Initializing InvoiceIntel: Smart Travel Claim, Bookkeeping or Expense Tracking for Professionals and Individuals...</p>
      </div>
    </div>
  );

  if (!user) {
    return <LoginPage onLogin={() => userService.login()} />;
  }

  const badgeInfo = () => {
    if (user.isAdmin) return { text: 'Admin Mode', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (user.isTrialActive) return { text: `Trial: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (user.planId === 'free') return { text: 'Limit Reached', color: 'bg-red-50 text-red-700 border-red-200' };
    const remaining = user.monthlyDocsLimit - user.docsUsedThisMonth;
    return { text: `${user.planId.toUpperCase()}: ${remaining} left`, color: remaining < 10 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };
  const badge = badgeInfo();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {isGeminiKeyMissing && (
        <div className="bg-amber-500 text-white animate-slideDown shadow-md relative z-50">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center text-xs font-bold gap-3">
            <ShieldAlert className="w-4 h-4" />
            <span>AI EXTRACTION OFFLINE: Gemini API Key missing. Manual entry enabled.</span>
            <button onClick={() => window.location.reload()} className="underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-xl">
                <Sparkles className="text-white w-6 h-6" />
              </div>
              <div className="ml-2">
                <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">InvoiceIntel</h1>
                <p className="text-[10px] text-slate-400 font-bold hidden md:block">Smart Travel Claim, Bookkeeping or Expense Tracking for Professionals and Individuals</p>
              </div>
            </div>

            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('expenses')} className={`flex items-center px-5 py-2 text-sm font-bold rounded-lg transition-all ${view === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List className="w-4 h-4 mr-2" />List</button>
              <button onClick={() => setView('analytics')} className={`flex items-center px-5 py-2 text-sm font-bold rounded-lg transition-all ${view === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><PieChartIcon className="w-4 h-4 mr-2" />Insights</button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsPricingModalOpen(true)}
                className={`hidden sm:flex items-center px-4 py-2 rounded-full text-xs font-black border transition-all hover:scale-105 active:scale-95 ${badge.color}`}
              >
                {badge.text}
              </button>

              <div className="hidden sm:flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                <select
                  value={budgets.defaultCurrency}
                  onChange={(e) => {
                    const newBudgets = { ...budgets, defaultCurrency: e.target.value };
                    setBudgets(newBudgets);
                    db.saveBudgets(newBudgets);
                  }}
                  className="bg-transparent text-xs font-bold text-slate-600 border-none focus:ring-0 cursor-pointer px-2"
                >
                  <optgroup label="Global">
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                    <option value="AUD">AUD (A$)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="CHF">CHF (Fr)</option>
                    <option value="NZD">NZD (NZ$)</option>
                  </optgroup>
                  <optgroup label="Asian">
                    <option value="CNY">CNY (¥)</option>
                    <option value="HKD">HKD (HK$)</option>
                    <option value="SGD">SGD (S$)</option>
                    <option value="KRW">KRW (₩)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="TWD">TWD (NT$)</option>
                    <option value="THB">THB (฿)</option>
                    <option value="IDR">IDR (Rp)</option>
                    <option value="MYR">MYR (RM)</option>
                    <option value="PHP">PHP (₱)</option>
                    <option value="VND">VND (₫)</option>
                    <option value="SAR">SAR (SR)</option>
                    <option value="AED">AED (Dh)</option>
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center gap-2 border-l pl-4">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-slate-100 transition-all group"
                  title="Your Profile"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">User Profile</p>
                    <p className="text-sm font-bold text-slate-700 leading-none">{user.name.split(' ')[0]}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Portfolio Tabs */}
      <div className="bg-white border-b border-slate-200 shadow-sm overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 py-2 overflow-x-auto no-scrollbar">
            {portfolios.map((portfolio: Portfolio) => (
              <div
                key={portfolio.id}
                className={`group flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${activePortfolioId === portfolio.id
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm border border-indigo-100'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                onClick={() => setActivePortfolioId(portfolio.id)}
              >
                <span>{portfolio.name}</span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleRenamePortfolio(portfolio.id, portfolio.name); }}
                    className="p-1 hover:bg-white rounded transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  {portfolios.length > 1 && (
                    <button
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleDeletePortfolio(portfolio.id); }}
                      className="p-1 hover:bg-white hover:text-red-600 rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button
              onClick={handleCreatePortfolio}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>New Page</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {view === 'expenses' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Plus className="w-5 h-5 text-indigo-600" />Scan Receipt</h2>
                  <FileUpload
                    onFilesSelect={handleFilesSelect}
                    isProcessing={isProcessing}
                    isDisabled={!userService.canUpload(user, 1).allowed}
                  />
                  {progressStatus && <div className="mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-xl text-xs text-center font-black animate-pulse border border-indigo-100">{progressStatus}</div>}
                  <div className="mt-4 pt-4 border-t text-center"><button onClick={() => setIsModalOpen(true)} className="text-sm font-bold text-indigo-600 hover:text-indigo-800">Or type details manually</button></div>
                </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><ImageIcon className="w-24 h-24" /></div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Total Expenses</p>
                  <p className="text-4xl font-black text-slate-900 mt-2">{budgets.defaultCurrency} {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="h-20 mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.categoryBreakdown.slice(0, 5)}>
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                          formatter={(value: number) => [`${budgets.defaultCurrency} ${value.toFixed(2)}`, 'Total']}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Top Category</p>
                  <p className="text-2xl font-black text-indigo-600 mt-2">{stats.categoryBreakdown[0]?.name || 'No data'}</p>
                  <p className="text-sm text-slate-500 font-medium">{budgets.defaultCurrency} {stats.categoryBreakdown[0]?.value.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/30">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Search expenses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setIsBudgetModalOpen(true)} icon={<Settings className="w-4 h-4" />}>Budget</Button>
                  <Button variant="secondary" className="flex-1 sm:flex-none" onClick={handleExport} icon={<Download className="w-4 h-4" />}>Export</Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50/50">
                    <tr>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Receipt</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date / Vendor</th>
                      <th className="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                      <th className="px-6 py-4 text-right text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          {expense.imageData ? (
                            <div
                              onClick={() => {
                                console.log(`[App] Opening image for ${expense.vendorName}. Has data: ${!!expense.imageData}`);
                                setViewingImage({ url: expense.imageData!, title: expense.vendorName });
                              }}
                              className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 transition-all flex items-center justify-center"
                            >
                              {expense.imageData.startsWith('data:application/pdf') ? (
                                <List className="w-5 h-5 text-slate-400" />
                              ) : (
                                <img src={expense.imageData} className="w-full h-full object-cover" />
                              )}
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                              <ImageIcon className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-xs font-medium text-slate-500">{expense.date}</p>
                          <p className="text-sm font-bold text-slate-900">{expense.vendorName}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                            {expense.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-black text-slate-900">
                          <span className="text-[10px] text-slate-400 mr-1">{expense.currency}</span>
                          {(Number(expense.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {expense.imageData && (
                              <button onClick={() => setViewingImage({ url: expense.imageData!, title: expense.vendorName })} className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50"><Eye className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => { setEditingItem(expense); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          <Sparkles className="w-8 h-8 mb-2 mx-auto opacity-20" />
                          <p className="text-sm font-bold">Start tracking your claims and bookkeeping today.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <AnalyticsView
            expenses={filteredExpenses}
            budgets={(activePortfolioId && budgets.portfolios[activePortfolioId]) ? budgets.portfolios[activePortfolioId] : ({} as BudgetMap)}
            defaultCurrency={budgets.defaultCurrency}
          />
        )}
      </main>

      <ExpenseModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingItem(undefined); }}
        onSave={handleSaveExpense}
        initialData={editingItem}
        portfolios={portfolios}
        defaultPortfolioId={activePortfolioId}
        defaultCurrency={budgets.defaultCurrency}
      />
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        budgets={budgets}
        onSave={handleSaveBudgets}
        portfolios={portfolios}
        activePortfolioId={activePortfolioId}
      />
      <PricingModal isOpen={isPricingModalOpen} onClose={() => setIsPricingModalOpen(false)} user={user} onSuccess={setUser} />
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onLogout={() => userService.logout().then(() => setUser(null))}
      />
      <ConsentModal
        isOpen={!!user && !user.hasConsented}
        onAccept={handleAcceptConsent}
        user={user!}
        onViewLegal={(type) => setLegalModal({ isOpen: true, type })}
      />

      <LegalModal
        isOpen={legalModal.isOpen}
        type={legalModal.type}
        onClose={() => setLegalModal(prev => ({ ...prev, isOpen: false }))}
      />

      <ImageViewer
        isOpen={!!viewingImage}
        onClose={() => setViewingImage(null)}
        imageUrl={viewingImage?.url}
        title={viewingImage?.title || ''}
      />
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-100 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-400 font-medium">
            © {new Date().getFullYear()} InvoiceIntel. All rights reserved.
          </p>
          <div className="flex gap-6">
            <button
              onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Privacy Policy
            </button>
            <button
              onClick={() => setLegalModal({ isOpen: true, type: 'terms' })}
              className="text-xs font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Terms of Service
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
