
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
import { validatePdfLimits, splitPdfIntoPages, isPDF } from './services/pdfService';
import { userService } from './services/userService';
import { stripeService } from './services/stripeService';
import { supabase } from './services/supabaseClient';
import { cameraService } from './services/cameraService';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

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
  const [toastMessage, setToastMessage] = useState<string>(''); // Toast notification
  const [isAccessDenied, setIsAccessDenied] = useState(false); // Registration limit reached

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
    const mode = params.get('mode');

    // Bridge Mode: If we are on the mobile bridge page, sit and wait for user to click "Return to App"
    // The "Return to App" button will trigger the custom scheme
    if (mode === 'mobile_bridge') {
      console.log("Bridge mode active");
      return; // logic handled in render
    }

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

  // Ensure activePortfolioId is always set if we have portfolios
  useEffect(() => {
    if (!activePortfolioId && portfolios.length > 0) {
      console.log("Auto-setting activePortfolioId to first portfolio");
      setActivePortfolioId(portfolios[0].id);
    }
  }, [portfolios, activePortfolioId]);

  useEffect(() => {
    // Moved data fetching to a reusable function
    const fetchData = async (sessionUser: any) => {
      try {
        setLoading(true);
        const profile = await userService.upsertProfile(sessionUser);
        setUser(profile);

        const data = await db.getAll(sessionUser.id);
        setExpenses(data);

        const savedBudgets = db.getBudgets();

        // Fetch Portfolios
        setIsPortfolioLoading(true);
        let portfolioData = await db.getPortfolios(sessionUser.id);

        if (portfolioData.length === 0) {
          const defaultPortfolio = await db.addPortfolio('General', sessionUser.id);
          portfolioData = [defaultPortfolio];
        }

        setPortfolios(portfolioData);
        const firstId = portfolioData[0]?.id;

        if (firstId) {
          setActivePortfolioId(prev => prev || firstId);

          const legacyGlobal = (savedBudgets as any)._legacyGlobal;
          if (legacyGlobal && !savedBudgets.portfolios[firstId]) {
            console.log("[App] Migrating legacy global budget to first portfolio:", firstId);
            savedBudgets.portfolios[firstId] = legacyGlobal;
            db.saveBudgets(savedBudgets);
          }
        }

        if (profile.defaultCurrency && profile.defaultCurrency !== savedBudgets.defaultCurrency) {
          savedBudgets.defaultCurrency = profile.defaultCurrency;
          db.saveBudgets(savedBudgets);
        }

        setBudgets(savedBudgets);
        setIsPortfolioLoading(false);
      } catch (err: any) {
        // Check for registration limit error
        if (err?.message === 'REGISTRATION_LIMIT_REACHED') {
          console.log('[App] Registration limit reached, showing access denied screen');
          setIsAccessDenied(true);
          setLoading(false);
          await supabase.auth.signOut(); // Sign out the blocked user
          return;
        }
        console.error("Data fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    // Initialize Auth Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // If we have a session but haven't loaded data for this user yet
      if (session?.user && (!user || user.id !== session.user.id)) {
        console.log("[App] Auth State Changed: Fetching Data");
        fetchData(session.user);
      } else if (!session) {
        setUser(null);
        setLoading(false);
      }
    });

    // Initial Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        fetchData(session.user);
      } else {
        setLoading(false);
      }
    });

    // Handle deep links (Supabase/Stripe redirects)
    const setupDeepLinks = async () => {
      CapApp.addListener('appUrlOpen', async (data: any) => {
        console.log('[App] App opened with URL:', data.url);

        const urlStr = data.url.replace('com.arivuaitech.invoiceintel://', 'https://dummy.com/');
        const url = new URL(urlStr);

        // 1. Handle Payment Redirects
        const payment = url.searchParams.get('payment');
        if (payment === 'success') {
          setPaymentStatus('success');
          setIsSyncing(true);
        } else if (payment === 'cancelled') {
          setPaymentStatus('cancelled');
        }

        // 2. Handle Supabase Auth Redirects
        if (data.url.includes('access_token=') || data.url.includes('refresh_token=')) {
          console.log('[App] Auth redirect detected');

          try {
            // Try hash first (common for OAuth flows)
            let params = new URLSearchParams(url.hash.substring(1));

            if (!params.has('access_token')) {
              params = url.searchParams;
            }

            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');

            if (access_token && refresh_token) {
              await supabase.auth.setSession({ access_token, refresh_token });
              // The onAuthStateChange listener will pick this up automatically
            }
          } catch (err) {
            console.error('[App] Error handling auth deep link:', err);
          }
        }
      });
    };
    setupDeepLinks();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      CapApp.removeAllListeners();
      subscription.unsubscribe();
    };
  }, []);

  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((item: ExpenseItem) => {
        const vendor = item.vendorName || '';
        const summary = item.summary || '';
        const matchesSearch = vendor.toLowerCase().includes(searchTerm.toLowerCase()) ||
          summary.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

        // Match active portfolio OR legacy items showing in the first portfolio
        // Fail-safe: if portfolios haven't loaded yet (length 0), show everything to avoid blank screen
        const isFirstPortfolio = portfolios.length > 0 && activePortfolioId === portfolios[0].id;
        const matchesPortfolio =
          portfolios.length === 0 || // FAIL OPEN: Show all if portfolios missing
          item.portfolioId === activePortfolioId ||
          (isFirstPortfolio && !item.portfolioId);

        return matchesSearch && matchesCategory && matchesPortfolio;
      })
      .sort((a: ExpenseItem, b: ExpenseItem) => {
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
    const totalAmount = filteredExpenses.reduce((sum: number, item: ExpenseItem) => sum + (Number(item.amount) || 0), 0);
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

    setIsProcessing(true);
    setProgressStatus('Validating files...');

    // === Step 1: Validate PDF limits (page count, file count, total pages) ===
    const validation = await validatePdfLimits(files);
    if (!validation.valid) {
      alert(validation.error);
      setIsProcessing(false);
      setProgressStatus('');
      return;
    }

    const totalPages = validation.totalPages!;

    // === Step 2: Check usage limit with ACTUAL page count ===
    const status = userService.canUpload(user, totalPages);
    if (!status.allowed) {
      const remaining = user.monthlyDocsLimit - user.docsUsedThisMonth;

      let message = '';
      if (status.reason === 'trial_limit') {
        message = `This upload requires ${totalPages} documents but you have ${remaining} remaining in your trial. Upgrade to process more.`;
      } else if (status.reason === 'plan_limit') {
        message = `This upload requires ${totalPages} documents but you have ${remaining} remaining this month. Upgrade for higher limits.`;
      } else if (status.reason === 'custom_limit') {
        message = `This upload would exceed your custom monthly limit. Please contact support.`;
      } else if (status.reason === 'suspicious_limit') {
        message = `Your account has reached the maximum monthly scanning limit (2500). To prevent suspicious activity or bot usage, your account has been temporarily restricted. Please contact arivu.ai.tech@gmail.com to verify and unblock your account.`;
      } else {
        message = 'Your subscription has expired. Please renew to continue uploading.';
      }

      alert(message);
      setIsPricingModalOpen(true);
      setIsProcessing(false);
      setProgressStatus('');
      return;
    }

    // === Step 3: Split multi-page PDFs into individual pages ===
    setProgressStatus('Preparing documents...');
    const filesToProcess: Array<{ blob: File | Blob; displayName: string; sourceFile: string }> = [];

    for (const file of files) {
      const fileName = file instanceof File ? file.name : `captured-receipt-${Date.now()}.jpg`;

      if (isPDF(file) && file instanceof File) {
        setProgressStatus(`Splitting ${fileName}...`);
        try {
          const pages = await splitPdfIntoPages(file);
          pages.forEach((pageBlob, index) => {
            filesToProcess.push({
              blob: pageBlob,
              displayName: `${fileName} - Page ${index + 1}`,
              sourceFile: fileName
            });
          });
        } catch (error) {
          console.error(`Failed to split PDF: ${fileName}`, error);
          alert(`Failed to process "${fileName}". It may be corrupted or password-protected.`);
          setIsProcessing(false);
          setProgressStatus('');
          return;
        }
      } else {
        filesToProcess.push({
          blob: file,
          displayName: fileName,
          sourceFile: fileName
        });
      }
    }

    // === Step 4: Process each page/file ===
    let successCount = 0;
    const filesBySource: Record<string, number> = {};

    for (let i = 0; i < filesToProcess.length; i++) {
      const item = filesToProcess[i];
      setProgressStatus(`Analyzing ${i + 1}/${filesToProcess.length}... (${item.displayName})`);

      try {
        const [data, imageInfo] = await Promise.all([
          extractInvoiceData(item.blob),
          fileToGenerativePart(item.blob)
        ]);

        const newExpense: ExpenseItem = {
          id: crypto.randomUUID(),
          vendorName: data.vendorName || 'Unknown Vendor',
          date: formatDate(data.date),
          amount: Number(data.amount) || 0,
          currency: budgets.defaultCurrency,
          category: data.category as ExpenseCategory || ExpenseCategory.OTHERS,
          summary: data.summary || '',
          createdAt: Date.now(),
          fileName: item.displayName, // Use page-aware name
          imageData: `data:${imageInfo.mimeType};base64,${imageInfo.data}`,
          portfolioId: activePortfolioId || undefined,
          receiptId: data.receiptId || undefined
        };

        await db.add(newExpense, user.id);
        checkBudgetWarning(newExpense.category, newExpense.amount);
        successCount++;

        // Track successful extractions per source file
        filesBySource[item.sourceFile] = (filesBySource[item.sourceFile] || 0) + 1;

      } catch (error: any) {
        console.error(`Extraction failed for ${item.displayName}:`, error);
        // Continue processing remaining pages
      }
    }

    // === Step 5: Update user usage and refresh ===
    if (successCount > 0) {
      const updatedUser = await userService.recordUsage(user, successCount);
      setUser(updatedUser);
      await refreshExpenses();

      // Show success summary
      const sourceCount = Object.keys(filesBySource).length;
      const summary = sourceCount === 1
        ? `✓ Successfully extracted ${successCount} invoice${successCount > 1 ? 's' : ''}`
        : `✓ Successfully extracted ${successCount} invoices from ${sourceCount} documents`;

      setToastMessage(summary);
      setTimeout(() => setToastMessage(''), 5000); // Auto-hide after 5 seconds
    } else if (filesToProcess.length > 0) {
      alert("AI was unable to extract data from the documents. Please try again with clearer images or enter details manually.");
    }

    setIsProcessing(false);
    setProgressStatus('');
  }

  async function handleMobileCameraScan() {
    if (!user) return;
    const status = userService.canUpload(user, 1);
    if (!status.allowed) {
      setIsPricingModalOpen(true);
      return;
    }

    try {
      const photo = await cameraService.takePhoto();
      if (photo) {
        setIsProcessing(true);
        setProgressStatus('Analyzing captured receipt...');

        // Convert base64 to Blob/File for compatibility with existing extractInvoiceData
        const byteCharacters = atob(photo.base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: `image/${photo.format}` });

        await handleFilesSelect([blob]);
      }
    } catch (error) {
      console.error("Camera scan failed:", error);
      alert("Failed to capture photo.");
    } finally {
      setIsProcessing(false);
      setProgressStatus('');
    }
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
    const dataToExport = filteredExpenses.map(({ id, createdAt, imageData, portfolioId, ...rest }) => ({
      ...rest,
      date_created: new Date(createdAt).toLocaleString()
    }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Expenses");

    if (Capacitor.isNativePlatform()) {
      try {
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const fileName = `InvoiceIntel_Export_${new Date().toISOString().split('T')[0]}.xlsx`;

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: wbout,
          directory: Directory.Cache, // Use Cache for better mobile permissions
          encoding: Encoding.UTF8
        });

        await Share.share({
          title: 'Export Expenses',
          text: 'Here is your expense report.',
          url: savedFile.uri,
          dialogTitle: 'Share your expenses'
        });

      } catch (e) {
        console.warn("Mobile export/share cancelled or failed:", e);
        // alert("Failed to export on mobile. Please check permissions."); // Suppress alert for better UX on cancel
      }
    } else {
      XLSX.writeFile(wb, `InvoiceIntel_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
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

  // Access Denied Screen (Registration Limit Reached)
  if (isAccessDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-amber-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-3">
            Registration Currently Closed
          </h2>
          <p className="text-slate-600 mb-6">
            We've reached our current user capacity limit. To request early access, please contact us:
          </p>
          <a
            href="mailto:arivu.ai.tech@gmail.com?subject=Invoice Intel Access Request"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg w-full sm:w-auto"
          >
            <Crown className="w-5 h-5" />
            Request Access
          </a>
          <p className="text-xs text-slate-400 mt-6">
            arivu.ai.tech@gmail.com
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  const badgeInfo = () => {
    if (user.isAdmin) return { text: 'Admin Mode', color: 'bg-purple-50 text-purple-700 border-purple-200' };
    if (user.isTrialActive) return { text: `Trial: ${user.monthlyDocsLimit - user.docsUsedThisMonth} left`, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (user.planId === 'free') return { text: 'Limit Reached', color: 'bg-red-50 text-red-700 border-red-200' };

    const remaining = user.monthlyDocsLimit - user.docsUsedThisMonth;

    if (user.planId === 'business' && remaining <= 0) {
      const overage = Math.abs(remaining);
      return {
        text: `BUSINESS: +${overage} Overage`,
        color: 'bg-indigo-100 text-indigo-700 border-indigo-200 animate-pulse'
      };
    }

    return {
      text: `${user.planId.toUpperCase()}: ${remaining > 0 ? remaining : 0} left`,
      color: remaining < 10 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
    };
  };
  const badge = badgeInfo();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 overflow-x-hidden w-full touch-pan-y">
      {/* Bridge Overlay */}
      {(() => {
        const params = new URLSearchParams(window.location.search);
        const mode = params.get('mode');
        const payment = params.get('payment');

        if (mode !== 'mobile_bridge') return null;

        const isSuccess = payment === 'success';

        return (
          <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 text-center">
            <div className={`w-20 h-20 ${isSuccess ? 'bg-green-100' : 'bg-red-100'} rounded-full flex items-center justify-center mb-6`}>
              {isSuccess ? (
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              ) : (
                <X className="w-10 h-10 text-red-600" />
              )}
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">
              {isSuccess ? 'Payment Completed' : 'Payment Cancelled'}
            </h2>
            <p className="text-slate-500 mb-8">
              {isSuccess
                ? 'Your transaction was processed successfully.'
                : 'The payment process was cancelled.'}
            </p>

            <a
              href={`com.arivuaitech.invoiceintel://${isSuccess ? 'payment/success' : 'payment/cancelled'}?${params.toString()}`}
              className={`w-full py-4 ${isSuccess ? 'bg-indigo-600' : 'bg-slate-800'} text-white rounded-xl font-bold text-lg shadow-xl ${isSuccess ? 'shadow-indigo-200' : 'shadow-slate-200'}`}
            >
              Return to App
            </a>
          </div>
        );
      })()}

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

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center animate-slideDown pointer-events-none">
          <div className="bg-green-600 text-white px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px] pointer-events-auto">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-sm font-bold">{toastMessage}</span>
            <button
              onClick={() => setToastMessage('')}
              className="ml-2 p-1 hover:bg-green-700 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-xl shrink-0">
                <Sparkles className="text-white w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="ml-1 sm:ml-2 min-w-0 flex-shrink">
                <h1 className="text-base sm:text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 truncate max-w-[110px] sm:max-w-none">InvoiceIntel</h1>
                <p className="text-[10px] text-slate-400 font-bold hidden md:block italic">Smart Travel Claim, Bookkeeping or Expense Tracking for Professionals and Individuals</p>
              </div>
            </div>

            <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setView('expenses')} className={`flex items-center px-5 py-2 text-sm font-bold rounded-lg transition-all ${view === 'expenses' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List className="w-4 h-4 mr-2" />List</button>
              <button onClick={() => setView('analytics')} className={`flex items-center px-5 py-2 text-sm font-bold rounded-lg transition-all ${view === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><PieChartIcon className="w-4 h-4 mr-2" />Insights</button>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
              <button
                onClick={() => setIsPricingModalOpen(true)}
                className={`flex items-center px-1.5 sm:px-4 py-1 sm:py-2 rounded-full text-[9px] sm:text-xs font-black border transition-all hover:scale-105 active:scale-95 ${badge.color}`}
              >
                <CreditCard className="w-3 h-3 sm:hidden mr-0.5" />
                <span className="truncate max-w-[50px] sm:max-w-none">{badge.text}</span>
              </button>

              <div className="flex items-center gap-1 sm:gap-2 bg-slate-100 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
                <select
                  value={budgets.defaultCurrency}
                  onChange={async (e) => {
                    const newCurrency = e.target.value;
                    const newBudgets = { ...budgets, defaultCurrency: newCurrency };

                    setBudgets(newBudgets);
                    db.saveBudgets(newBudgets);
                    setExpenses(prev => prev.map(exp => ({ ...exp, currency: newCurrency })));

                    if (user) {
                      try {
                        setIsSyncing(true);
                        await db.updateAllExpCurrency(user.id, newCurrency);
                        const updatedUser = await userService.updateProfileCurrency(user.id, newCurrency);
                        setUser(updatedUser);
                      } catch (err) {
                        console.error("Cloud synchronization failed:", err);
                        alert("Settings saved locally, but failed to sync with your Cloud profile.");
                      } finally {
                        setIsSyncing(false);
                      }
                    }
                  }}
                  className="bg-transparent text-[10px] sm:text-xs font-black text-slate-600 border-none focus:ring-0 cursor-pointer px-1 sm:px-2"
                >
                  <optgroup label="Global">
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="JPY">JPY</option>
                  </optgroup>
                  <optgroup label="Asian">
                    <option value="MYR">MYR</option>
                    <option value="SGD">SGD</option>
                    <option value="CNY">CNY</option>
                  </optgroup>
                </select>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 border-l pl-1.5 sm:pl-4">
                <button
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-1.5 p-1 sm:px-3 sm:py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-indigo-200 hover:bg-slate-100 transition-all group lg:min-w-[120px]"
                  title="Your Profile"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors shrink-0">
                    <User className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="hidden lg:block text-left truncate">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">User Profile</p>
                    <p className="text-sm font-bold text-slate-700 leading-none truncate">{user.name.split(' ')[0]}</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {view === 'expenses' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
              <div className="lg:col-span-1">
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                  <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2 text-slate-800"><Plus className="w-5 h-5 text-indigo-600" />Scan Receipt</h2>
                  <FileUpload
                    onFilesSelect={handleFilesSelect}
                    isProcessing={isProcessing}
                    isDisabled={!userService.canUpload(user, 1).allowed}
                  />
                  {Capacitor.isNativePlatform() && (
                    <button
                      onClick={handleMobileCameraScan}
                      disabled={isProcessing || !userService.canUpload(user, 1).allowed}
                      className="w-full mt-3 sm:mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                    >
                      <Sparkles className="w-5 h-5" />
                      Scan Receipt with Camera
                    </button>
                  )}
                  {progressStatus && <div className="mt-3 sm:mt-4 p-3 bg-indigo-50 text-indigo-700 rounded-xl text-[10px] sm:text-xs text-center font-black animate-pulse border border-indigo-100">{progressStatus}</div>}
                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t text-center"><button onClick={() => setIsModalOpen(true)} className="text-xs sm:text-sm font-bold text-indigo-600 hover:text-indigo-800">Or type details manually</button></div>
                </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-4 opacity-5"><ImageIcon className="w-16 sm:w-24 h-16 sm:h-24" /></div>
                  <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Total Expenses</p>
                  <p className="text-2xl sm:text-4xl font-black text-slate-900 mt-1 sm:mt-2">{budgets.defaultCurrency} {stats.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  <div className="h-16 sm:h-20 mt-4 sm:mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.categoryBreakdown.slice(0, 5)}>
                        <Tooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '10px' }}
                          formatter={(value: any, name: any, props: any) => [
                            `${budgets.defaultCurrency} ${Number(value || 0).toFixed(2)}`,
                            props.payload.name || 'Category'
                          ]}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {stats.categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">Top Category</p>
                  <p className="text-xl sm:text-2xl font-black text-indigo-600 mt-1 sm:mt-2">{stats.categoryBreakdown[0]?.name || 'No data'}</p>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">{budgets.defaultCurrency} {stats.categoryBreakdown[0]?.value.toFixed(2) || '0.00'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-3 sm:p-5 border-b flex flex-col sm:flex-row gap-3 sm:gap-4 justify-between items-center bg-slate-50/30">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" className="w-full pl-10 pr-4 py-2 sm:py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Search expenses..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button variant="secondary" className="flex-1 sm:flex-none text-[10px] sm:text-xs py-2" onClick={() => setIsBudgetModalOpen(true)} icon={<Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}>Budget</Button>
                  <Button variant="secondary" className="flex-1 sm:flex-none text-[10px] sm:text-xs py-2" onClick={handleExport} icon={<Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}>Export</Button>
                </div>
              </div>
              {/* Table Container with Max 8 Rows Visible */}
              <div className="overflow-x-auto w-full -mx-4 sm:mx-0 px-4 sm:px-0">
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Receipt</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Vendor Name</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Summary</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Receipt ID</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-left text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                        <th className="px-3 sm:px-6 py-3 sm:py-4 text-right text-[9px] sm:text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                        <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            {expense.imageData ? (
                              <div
                                onClick={() => setViewingImage({ url: expense.imageData!, title: expense.vendorName })}
                                className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 ring-indigo-500 transition-all flex items-center justify-center shrink-0"
                              >
                                {expense.imageData.startsWith('data:application/pdf') ? (
                                  <List className="w-5 h-5 text-slate-400" />
                                ) : (
                                  <img src={expense.imageData} className="w-full h-full object-cover" />
                                )}
                              </div>
                            ) : (
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center">
                                <ImageIcon className="w-4 h-4 text-slate-300" />
                              </div>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <p className="text-[10px] sm:text-xs font-medium text-slate-500">{expense.date}</p>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[120px] sm:max-w-none">{expense.vendorName || '-'}</p>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <p
                              className="text-[10px] sm:text-xs text-slate-500 italic truncate max-w-[150px] sm:max-w-[200px] cursor-help"
                              title={expense.summary || '-'}
                            >
                              {expense.summary || '-'}
                            </p>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            {expense.receiptId ? (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[8px] sm:text-[9px] font-black text-slate-500">
                                {expense.receiptId}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-300">-</span>
                            )}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {expense.category}
                            </span>
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-right font-black text-slate-900">
                            <span className="text-[8px] sm:text-[10px] text-slate-400 mr-0.5 sm:mr-1">{expense.currency}</span>
                            {(Number(expense.amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 sm:px-6 py-3 sm:py-4 text-right text-sm font-medium">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => { setEditingItem(expense); setIsModalOpen(true); }} className="text-slate-400 hover:text-indigo-600 p-1.5 sm:p-2 rounded-lg hover:bg-indigo-50"><Edit2 className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-600 p-1.5 sm:p-2 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                            <Sparkles className="w-8 h-8 mb-2 mx-auto opacity-20" />
                            <p className="text-sm font-bold">Start tracking your claims and bookkeeping today.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
        onUpdate={setUser}
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
          <div className="flex flex-col md:flex-row items-center gap-2 md:gap-4">
            <p className="text-xs text-slate-400 font-medium">
              © {new Date().getFullYear()} InvoiceIntel. All rights reserved.
            </p>
            <span className="hidden md:block text-slate-200">|</span>
            <a
              href="https://www.arivu-ai.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-black uppercase tracking-widest text-indigo-500 hover:text-indigo-600 transition-colors"
            >
              arivu-ai.com
            </a>
          </div>
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

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-around items-center z-[60] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setView('expenses')}
          className={`flex flex-col items-center gap-1 transition-colors ${view === 'expenses' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <div className={`p-1.5 rounded-xl ${view === 'expenses' ? 'bg-indigo-50' : ''}`}>
            <List className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">List</span>
        </button>
        <button
          onClick={() => setView('analytics')}
          className={`flex flex-col items-center gap-1 transition-colors ${view === 'analytics' ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <div className={`p-1.5 rounded-xl ${view === 'analytics' ? 'bg-indigo-50' : ''}`}>
            <PieChartIcon className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-wider">Insights</span>
        </button>
      </div>
    </div >
  );
}
