import { Category, Expense, Budget } from '@/types/expense';
import { DEFAULT_CATEGORIES, validateCategory } from '@/data/defaultCategories';

export const STORAGE_KEYS = {
  EXPENSES: 'expense-manager-expenses',
  BUDGETS: 'expense-manager-budgets',
  CATEGORIES: 'expense-manager-categories',
} as const;

// Categories
export function getCategories(): Category[] {
  const stored = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
  if (stored) {
    const categories = JSON.parse(stored) as Category[];
    // Filter out any invalid categories (without sub-categories)
    return categories.filter(validateCategory);
  }
  // Initialize with defaults on first load
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(DEFAULT_CATEGORIES));
  return DEFAULT_CATEGORIES;
}

export function saveCategories(categories: Category[]): void {
  // Only save categories that have sub-categories
  const validCategories = categories.filter(validateCategory);
  localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(validCategories));
}

export function addCategory(category: Category): boolean {
  if (!validateCategory(category)) {
    return false; // Cannot add category without sub-categories
  }
  const categories = getCategories();
  categories.push(category);
  saveCategories(categories);
  return true;
}

export function updateCategory(categoryId: string, updates: Partial<Category>): boolean {
  const categories = getCategories();
  const index = categories.findIndex(c => c.id === categoryId);
  if (index === -1) return false;
  
  const updated = { ...categories[index], ...updates };
  if (!validateCategory(updated)) {
    return false; // Cannot update to have no sub-categories
  }
  
  categories[index] = updated;
  saveCategories(categories);
  return true;
}

export function deleteCategory(categoryId: string): boolean {
  const categories = getCategories();
  const filtered = categories.filter(c => c.id !== categoryId);
  if (filtered.length === categories.length) return false;
  saveCategories(filtered);
  return true;
}

// Sub-categories
export function addSubCategory(categoryId: string, subCategory: { id: string; name: string }): boolean {
  const categories = getCategories();
  const category = categories.find(c => c.id === categoryId);
  if (!category) return false;
  
  category.subCategories.push(subCategory);
  saveCategories(categories);
  return true;
}

export function updateSubCategory(
  categoryId: string, 
  subCategoryId: string, 
  updates: { name: string }
): boolean {
  const categories = getCategories();
  const category = categories.find(c => c.id === categoryId);
  if (!category) return false;
  
  const subCat = category.subCategories.find(sc => sc.id === subCategoryId);
  if (!subCat) return false;
  
  subCat.name = updates.name;
  saveCategories(categories);
  return true;
}

export function deleteSubCategory(categoryId: string, subCategoryId: string): boolean {
  const categories = getCategories();
  const category = categories.find(c => c.id === categoryId);
  if (!category) return false;
  
  // Cannot delete if it's the last sub-category
  if (category.subCategories.length <= 1) {
    return false;
  }
  
  category.subCategories = category.subCategories.filter(sc => sc.id !== subCategoryId);
  saveCategories(categories);
  return true;
}

// Expenses
export function getExpenses(): Expense[] {
  const stored = localStorage.getItem(STORAGE_KEYS.EXPENSES);
  return stored ? JSON.parse(stored) : [];
}

export function saveExpenses(expenses: Expense[]): void {
  localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
}

export function addExpense(expense: Expense): void {
  const expenses = getExpenses();
  expenses.push(expense);
  saveExpenses(expenses);
}

export function deleteExpense(expenseId: string): boolean {
  const expenses = getExpenses();
  const filtered = expenses.filter(e => e.id !== expenseId);
  if (filtered.length === expenses.length) return false;
  saveExpenses(filtered);
  return true;
}

// Budgets
export function getBudgets(): Budget[] {
  const stored = localStorage.getItem(STORAGE_KEYS.BUDGETS);
  return stored ? JSON.parse(stored) : [];
}

export function saveBudgets(budgets: Budget[]): void {
  localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
}

export function setBudget(budget: Budget): void {
  const budgets = getBudgets();
  const key = `${budget.categoryId}_${budget.subCategoryId}_${budget.month}_${budget.year}`;
  const existingIndex = budgets.findIndex(
    b => `${b.categoryId}_${b.subCategoryId}_${b.month}_${b.year}` === key
  );
  
  if (existingIndex >= 0) {
    budgets[existingIndex] = budget;
  } else {
    budgets.push(budget);
  }
  saveBudgets(budgets);
}

export function deleteBudget(budgetId: string): boolean {
  const budgets = getBudgets();
  const filtered = budgets.filter(b => b.id !== budgetId);
  if (filtered.length === budgets.length) return false;
  saveBudgets(filtered);
  return true;
}

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
