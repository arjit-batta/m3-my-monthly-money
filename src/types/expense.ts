export type PaymentMode = 'cash' | 'upi' | 'card' | 'netbanking' | 'wallet';

export interface SubCategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  subCategories: SubCategory[]; // Must have at least 1
}

export interface Expense {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  categoryId: string;
  subCategoryId: string; // Required, cannot be empty
  paymentMode: PaymentMode;
  notes?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  subCategoryId: string;
  month: number; // 1-12
  year: number;
  amount: number;
  createdAt: string;
}

export interface SubCategorySpending {
  subCategoryId: string;
  subCategoryName: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
}

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  icon: string;
  color: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  percentage: number;
  subCategories: SubCategorySpending[];
}

export interface MonthlyOverview {
  month: number;
  year: number;
  totalBudget: number;
  totalSpent: number;
  categories: CategorySpending[];
}
