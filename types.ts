
export enum ExpenseCategory {
  FOOD = 'Food & Dining',
  PARKING = 'Parking',
  TOLL = 'Toll',
  OPTICAL = 'Optical',
  DENTAL = 'Dental',
  CLINIC = 'Clinic/Medical',
  MILEAGE = 'Mileage',
  AIRPORT = 'Airport Charges',
  TRANSPORT = 'Transportation',
  UTILITY = 'Utility Bills',
  REPAIR = 'Repair & Maintenance',
  HOUSE_TAX = 'House Tax',
  FLIGHT = 'Flights',
  HOTEL = 'Accommodation',
  OTHERS = 'Others'
}

export interface Portfolio {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
}

export interface ExpenseItem {
  id: string;
  vendorName: string;
  date: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  category: ExpenseCategory;
  summary: string; // Short description
  createdAt: number;
  fileName?: string;
  imageData?: string; // Base64 string of the receipt image
  portfolioId?: string; // Optional: Link to a portfolio/page
}

export interface Stats {
  totalAmount: number;
  count: number;
  categoryBreakdown: { name: string; value: number }[];
}

export type BudgetMap = Record<ExpenseCategory, number>;

export type SortField = 'date' | 'amount' | 'vendorName';
export type SortOrder = 'asc' | 'desc';

// --- New Types for Auth & Billing ---

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;

  // Subscription Fields
  planId: 'free' | 'basic' | 'pro' | 'business';
  subscriptionExpiry: number | null; // Timestamp
  monthlyDocsLimit: number;
  docsUsedThisMonth: number;

  trialStartDate: number;
  isTrialActive: boolean;
  stripeCustomerId?: string; // Added to handle portal redirects
  isAdmin?: boolean; // New: admin bypass
  hasConsented?: boolean; // New: informed consent tracking
  consentTimestamp?: number | null; // New: when they consented
  consentVersion?: string; // New: version of terms accepted
  consentIp?: string; // New: IP address at consent
}

export interface PricingTier {
  id: 'basic' | 'pro' | 'business';
  name: string;
  limit: number;
  price: number; // in MYR
  priceUSD: number; // in USD
  description: string;
  features: string[];
  popular?: boolean;
}
