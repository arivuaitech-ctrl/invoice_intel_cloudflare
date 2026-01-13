
import { ExpenseItem, BudgetMap, ExpenseCategory } from '../types';
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
  currency: data.currency || 'RM',
  category: data.category as ExpenseCategory,
  summary: data.summary || '',
  fileName: data.file_name,
  imageData: undefined, // Will be hydrated from local storage
  createdAt: data.created_at
});

export const db = {
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
        return { ...exp, imageData: localData || undefined };
      } catch (err) {
        console.warn(`Could not load local image for ${exp.id}:`, err);
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
    // 1. Update sensitive image data locally
    if (updatedItem.imageData) {
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

  getBudgets: (): BudgetMap => {
    const data = localStorage.getItem('invoice_intel_budgets_v1');
    if (data) return JSON.parse(data);

    return {
      [ExpenseCategory.FOOD]: 0,
      [ExpenseCategory.PARKING]: 0,
      [ExpenseCategory.TOLL]: 0,
      [ExpenseCategory.OPTICAL]: 0,
      [ExpenseCategory.DENTAL]: 0,
      [ExpenseCategory.CLINIC]: 0,
      [ExpenseCategory.MILEAGE]: 0,
      [ExpenseCategory.AIRPORT]: 0,
      [ExpenseCategory.TRANSPORT]: 0,
      [ExpenseCategory.UTILITY]: 0,
      [ExpenseCategory.REPAIR]: 0,
      [ExpenseCategory.HOUSE_TAX]: 0,
      [ExpenseCategory.FLIGHT]: 0,
      [ExpenseCategory.HOTEL]: 0,
      [ExpenseCategory.OTHERS]: 0,
    };
  },

  saveBudgets: (budgets: BudgetMap): void => {
    localStorage.setItem('invoice_intel_budgets_v1', JSON.stringify(budgets));
  }
};
