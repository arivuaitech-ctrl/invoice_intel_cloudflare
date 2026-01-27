
import { ExpenseItem, BudgetMap, MultiScopeBudget, ExpenseCategory, Portfolio } from '../types';
import { supabase } from './supabaseClient';


// Local Image Storage (IndexedDB) for PDPA Compliance
const DB_NAME = 'InvoiceIntelLocal';
const STORE_NAME = 'receipt_images';

const getLocalDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const localImageStore = {
  save: async (id: string, data: string): Promise<void> => {
    const db = await getLocalDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  get: async (id: string): Promise<string | null> => {
    const db = await getLocalDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },
  delete: async (id: string): Promise<void> => {
    const db = await getLocalDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  clear: async (): Promise<void> => {
    const db = await getLocalDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};

const mapToDb = (item: ExpenseItem, userId?: string) => {
  const data: any = {
    id: item.id,
    vendor_name: item.vendorName,
    date: item.date,
    amount: item.amount,
    currency: item.currency,
    category: item.category,
    summary: item.summary,
    file_name: item.fileName,
    // image_data: item.imageData, // REMOVED FOR PDPA COMPLIANCE
    portfolio_id: item.portfolioId,
    receipt_id: item.receiptId,
    created_at: item.createdAt
  };

  if (userId) {
    data.user_id = userId;
  }

  return data;
};

const mapFromDb = (data: any): ExpenseItem => ({
  id: data.id,
  vendorName: data.vendor_name,
  date: data.date,
  amount: Number(data.amount) || 0,
  currency: data.currency || 'USD',
  category: data.category as ExpenseCategory,
  summary: data.summary || '',
  fileName: data.file_name,
  imageData: undefined, // Will be hydrated from local storage
  portfolioId: data.portfolio_id,
  receiptId: data.receipt_id,
  createdAt: data.created_at
});

export const db = {
  // --- Portfolio Methods ---
  getPortfolios: async (userId: string): Promise<Portfolio[]> => {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Error fetching portfolios:", error);
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      userId: p.user_id,
      createdAt: new Date(p.created_at).getTime()
    }));
  },

  addPortfolio: async (name: string, userId: string): Promise<Portfolio> => {
    const { data, error } = await supabase
      .from('portfolios')
      .insert([{ name, user_id: userId }])
      .select()
      .single();

    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      userId: data.user_id,
      createdAt: new Date(data.created_at).getTime()
    };
  },

  updatePortfolio: async (id: string, name: string): Promise<void> => {
    const { error } = await supabase
      .from('portfolios')
      .update({ name })
      .eq('id', id);

    if (error) throw error;
  },

  deletePortfolio: async (id: string, userId: string): Promise<void> => {
    // 1. Delete associated expenses first (or rely on Cascade if configured, but we have RLS & local images)
    // For now, manual cleanup for local images and then delete from cloud
    const { data: expenses } = await supabase
      .from('expenses')
      .select('id')
      .eq('portfolio_id', id)
      .eq('user_id', userId);

    if (expenses) {
      for (const exp of expenses) {
        await localImageStore.delete(exp.id);
      }
    }

    // 2. Delete portfolio (this will delete linked expenses in cloud if CASCADE is set)
    const { error } = await supabase
      .from('portfolios')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
  },

  // --- Expense Methods ---
  getAll: async (userId: string): Promise<ExpenseItem[]> => {
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error("Error fetching expenses:", error);
      return [];
    }

    const expenses = (data || []).map(mapFromDb);

    // Hydrate images from local storage
    return Promise.all(expenses.map(async (exp: ExpenseItem) => {
      try {
        const localData = await localImageStore.get(exp.id);
        if (localData) {
          console.log(`[DB] Hydrated image for ${exp.id} (${exp.vendorName})`);
        } else {
          console.warn(`[DB] No local image found for ${exp.id}`);
        }
        return { ...exp, imageData: localData || undefined };
      } catch (err) {
        console.error(`[DB] Error loading local image for ${exp.id}:`, err);
        return exp;
      }
    }));
  },

  add: async (item: ExpenseItem, userId: string): Promise<void> => {
    // 1. Save sensitive image data locally
    if (item.imageData) {
      await localImageStore.save(item.id, item.imageData);
    }

    // 2. Save metadata to Supabase (without image data)
    const { error } = await supabase
      .from('expenses')
      .insert([mapToDb(item, userId)]);

    if (error) {
      console.error("Error adding expense:", error);
      throw error;
    }
  },

  update: async (updatedItem: ExpenseItem, userId: string): Promise<void> => {
    if (updatedItem.imageData) {
      console.log(`[DB] Saving new/updated image for ${updatedItem.id}`);
      await localImageStore.save(updatedItem.id, updatedItem.imageData);
    }

    // 2. Update metadata in Supabase
    const payload = mapToDb(updatedItem);
    delete payload.id;
    delete payload.user_id;
    delete payload.created_at;

    const { data, error } = await supabase
      .from('expenses')
      .update(payload)
      .eq('id', updatedItem.id)
      .eq('user_id', userId)
      .select();

    if (error) {
      console.error("Supabase Update Error:", error);
      throw error;
    }
  },

  delete: async (id: string, userId: string): Promise<void> => {
    // 1. Delete local image
    await localImageStore.delete(id);

    // 2. Delete metadata from Supabase
    const { error, count } = await supabase
      .from('expenses')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      console.error("Supabase Delete Error:", error);
      throw error;
    }
  },

  clearAll: async (userId: string): Promise<void> => {
    // 1. Clear local storage
    await localImageStore.clear();

    // 2. Clear cloud storage
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('user_id', userId);

    if (error) throw error;
  },

  updateAllExpCurrency: async (userId: string, newCurrency: string): Promise<void> => {
    const { error } = await supabase
      .from('expenses')
      .update({ currency: newCurrency })
      .eq('user_id', userId);

    if (error) {
      console.error("Bulk currency update error:", error);
      throw error;
    }
  },

  getBudgets: (): MultiScopeBudget => {
    const data = localStorage.getItem('invoice_intel_budgets_v5');
    if (data) return JSON.parse(data);

    // Migration from v4 (Remove Global)
    const v4Data = localStorage.getItem('invoice_intel_budgets_v4');
    if (v4Data) {
      const v4 = JSON.parse(v4Data);
      const budgets: MultiScopeBudget = { portfolios: v4.portfolios || {}, defaultCurrency: 'USD' };
      // Carry over global as a fallback for the first page if needed
      if (v4.global) {
        (budgets as any)._legacyGlobal = v4.global;
      }
      return budgets;
    }

    // Deep legacy migration from v3
    const v3Data = localStorage.getItem('invoice_intel_budgets_v3');
    if (v3Data) {
      const v3 = JSON.parse(v3Data);
      const portfolios: Record<string, BudgetMap> = {};
      Object.entries(v3.assignments || {}).forEach(([pId, profId]) => {
        const prof = (v3.profiles || []).find((p: any) => p.id === profId);
        if (prof) portfolios[pId] = prof.map;
      });
      const budgets: MultiScopeBudget = { portfolios, defaultCurrency: 'USD' };
      const globalProfile = (v3.profiles || []).find((p: any) => p.id === 'global') || (v3.profiles || [])[0];
      if (globalProfile) {
        (budgets as any)._legacyGlobal = globalProfile.map;
      }
      return budgets;
    }

    return { portfolios: {}, defaultCurrency: 'USD' };
  },

  saveBudgets: (budgets: MultiScopeBudget): void => {
    localStorage.setItem('invoice_intel_budgets_v5', JSON.stringify(budgets));
  }
};
