import { supabase } from '@/integrations/supabase/client';
import { Category, Expense, Budget, PaymentMode, SubCategory } from '@/types/expense';
import { DEFAULT_CATEGORIES } from '@/data/defaultCategories';
import { DEFAULT_PAYMENT_MODES } from '@/data/defaultPaymentModes';

// Helper to get current user ID
async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Generate unique ID
export function generateId(): string {
  return crypto.randomUUID();
}

// Track initialization state per user to prevent concurrent calls
const initializationInProgress = new Map<string, Promise<void>>();

// ============= Categories =============

export async function getCategories(): Promise<Category[]> {
  const userId = await getUserId();
  
  // Check if categories exist
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // If no categories exist, initialize with defaults (with concurrency protection)
  if (!categories || categories.length === 0) {
    await ensureDefaultCategoriesInitialized(userId);
    
    // Re-fetch after initialization
    const { data: newCategories, error: refetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId);
    
    if (refetchError) throw refetchError;
    
    const { data: subCategories } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('user_id', userId);
    
    return (newCategories || []).map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: '',
      subCategories: (subCategories || [])
        .filter(sc => sc.category_id === cat.id)
        .map(sc => ({ id: sc.id, name: sc.name })),
    }));
  }
  
  // Fetch sub-categories for each category
  const { data: subCategories, error: subError } = await supabase
    .from('sub_categories')
    .select('*')
    .eq('user_id', userId);
  
  if (subError) throw subError;
  
  // Map to Category type with nested sub-categories
  return categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: '',
    subCategories: (subCategories || [])
      .filter(sc => sc.category_id === cat.id)
      .map(sc => ({ id: sc.id, name: sc.name })),
  }));
}

/**
 * Ensures default categories are initialized exactly once per user.
 * Uses in-memory locking to prevent concurrent initialization attempts.
 * Skips initialization if categories already exist (doesn't overwrite user data).
 */
async function ensureDefaultCategoriesInitialized(userId: string): Promise<void> {
  const cacheKey = `categories_${userId}`;
  
  // If initialization is already in progress, wait for it
  const existingInit = initializationInProgress.get(cacheKey);
  if (existingInit) {
    await existingInit;
    return;
  }
  
  // Start initialization with lock
  const initPromise = initializeDefaultCategoriesOnce(userId);
  initializationInProgress.set(cacheKey, initPromise);
  
  try {
    await initPromise;
  } finally {
    initializationInProgress.delete(cacheKey);
  }
}

/**
 * Actually performs the initialization, checking again for existing data
 * to handle race conditions at the database level.
 */
async function initializeDefaultCategoriesOnce(userId: string): Promise<void> {
  // Double-check: another request may have created categories while we were waiting
  const { data: existingCategories } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (existingCategories && existingCategories.length > 0) {
    // Categories already exist, don't overwrite
    return;
  }
  
  // Insert categories one by one with conflict handling
  for (const cat of DEFAULT_CATEGORIES) {
    // Use a deterministic approach - check if category with same name exists
    const { data: existingCat } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', cat.name)
      .maybeSingle();
    
    let categoryId: string;
    
    if (existingCat) {
      // Category already exists, use its ID
      categoryId = existingCat.id;
    } else {
      // Insert new category
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert({ user_id: userId, name: cat.name, icon: cat.icon })
        .select()
        .single();
      
      if (catError) {
        // If duplicate key error, another concurrent request created it - fetch and continue
        if (catError.code === '23505') {
          const { data: fetchedCat } = await supabase
            .from('categories')
            .select('id')
            .eq('user_id', userId)
            .eq('name', cat.name)
            .single();
          if (fetchedCat) {
            categoryId = fetchedCat.id;
          } else {
            throw catError;
          }
        } else {
          throw catError;
        }
      } else {
        categoryId = newCat.id;
      }
    }
    
    // Insert sub-categories (skip if they already exist)
    for (const sc of cat.subCategories) {
      const { data: existingSub } = await supabase
        .from('sub_categories')
        .select('id')
        .eq('category_id', categoryId)
        .eq('name', sc.name)
        .maybeSingle();
      
      if (!existingSub) {
        const { error: subError } = await supabase
          .from('sub_categories')
          .insert({ category_id: categoryId, user_id: userId, name: sc.name });
        
        // Ignore duplicate key errors
        if (subError && subError.code !== '23505') {
          throw subError;
        }
      }
    }
  }
}

export async function addCategory(category: { name: string; icon: string; subCategories: SubCategory[] }): Promise<string> {
  const userId = await getUserId();
  
  const { data: newCat, error: catError } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: category.name, icon: category.icon })
    .select()
    .single();
  
  if (catError) throw catError;
  
  // Insert sub-categories
  if (category.subCategories.length > 0) {
    const subCats = category.subCategories.map(sc => ({
      category_id: newCat.id,
      user_id: userId,
      name: sc.name,
    }));
    
    const { error: subError } = await supabase
      .from('sub_categories')
      .insert(subCats);
    
    if (subError) throw subError;
  }
  
  return newCat.id;
}

export async function updateCategory(categoryId: string, updates: { name?: string; icon?: string }): Promise<boolean> {
  const { error } = await supabase
    .from('categories')
    .update({ name: updates.name, icon: updates.icon })
    .eq('id', categoryId);
  
  return !error;
}

export async function deleteCategory(categoryId: string): Promise<boolean> {
  // Check if category has sub-categories
  const { data: subCategories, error: subCheckError } = await supabase
    .from('sub_categories')
    .select('id')
    .eq('category_id', categoryId)
    .limit(1);
  
  if (subCheckError) throw subCheckError;
  
  if (subCategories && subCategories.length > 0) {
    throw new Error('Cannot delete category: it still has sub-categories. Please delete all sub-categories first.');
  }
  
  // Check if category is used by any expenses
  const { data: expenses, error: expCheckError } = await supabase
    .from('expenses')
    .select('id')
    .eq('category_id', categoryId)
    .limit(1);
  
  if (expCheckError) throw expCheckError;
  
  if (expenses && expenses.length > 0) {
    throw new Error('Cannot delete category: it is used by existing expenses. Please reassign or delete those expenses first.');
  }
  
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);
  
  if (error) throw error;
  return true;
}

// ============= Sub-Categories =============

export async function addSubCategory(categoryId: string, name: string): Promise<string> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('sub_categories')
    .insert({ category_id: categoryId, user_id: userId, name })
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updateSubCategory(subCategoryId: string, name: string): Promise<boolean> {
  const { error } = await supabase
    .from('sub_categories')
    .update({ name })
    .eq('id', subCategoryId);
  
  return !error;
}

export async function deleteSubCategory(subCategoryId: string): Promise<boolean> {
  // Check if sub-category is used by any expenses
  const { data: expenses, error: checkError } = await supabase
    .from('expenses')
    .select('id')
    .eq('sub_category_id', subCategoryId)
    .limit(1);
  
  if (checkError) throw checkError;
  
  if (expenses && expenses.length > 0) {
    throw new Error('Cannot delete sub-category: it is used by existing expenses. Please reassign or delete those expenses first.');
  }
  
  const { error } = await supabase
    .from('sub_categories')
    .delete()
    .eq('id', subCategoryId);
  
  if (error) throw error;
  return true;
}

// ============= Expenses =============

export async function getExpenses(): Promise<Expense[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  
  if (error) throw error;
  
  return (data || []).map(exp => ({
    id: exp.id,
    amount: Number(exp.amount),
    date: exp.date,
    categoryId: exp.category_id,
    subCategoryId: exp.sub_category_id || '',
    paymentModeId: exp.payment_mode_id,
    notes: exp.notes || undefined,
    createdAt: exp.created_at,
  }));
}

export async function addExpense(expense: Omit<Expense, 'id' | 'createdAt'>): Promise<string> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: userId,
      amount: expense.amount,
      date: expense.date,
      category_id: expense.categoryId,
      sub_category_id: expense.subCategoryId || null,
      payment_mode_id: expense.paymentModeId,
      notes: expense.notes || null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updateExpense(expenseId: string, updates: Partial<Expense>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (updates.amount !== undefined) updateData.amount = updates.amount;
  if (updates.date !== undefined) updateData.date = updates.date;
  if (updates.categoryId !== undefined) updateData.category_id = updates.categoryId;
  if (updates.subCategoryId !== undefined) updateData.sub_category_id = updates.subCategoryId;
  if (updates.paymentModeId !== undefined) updateData.payment_mode_id = updates.paymentModeId;
  if (updates.notes !== undefined) updateData.notes = updates.notes;
  
  const { error } = await supabase
    .from('expenses')
    .update(updateData)
    .eq('id', expenseId);
  
  return !error;
}

export async function deleteExpense(expenseId: string): Promise<boolean> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId);
  
  return !error;
}

// ============= Budgets =============

export async function getBudgets(): Promise<Budget[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  return (data || []).map(b => ({
    id: b.id,
    categoryId: b.category_id,
    subCategoryId: b.sub_category_id || '',
    month: b.month,
    year: b.year,
    amount: Number(b.amount),
    createdAt: b.created_at,
  }));
}

export async function setBudget(budget: Omit<Budget, 'id' | 'createdAt'>): Promise<string> {
  const userId = await getUserId();
  
  // Upsert: update if exists, insert if not
  const { data, error } = await supabase
    .from('budgets')
    .upsert({
      user_id: userId,
      category_id: budget.categoryId,
      sub_category_id: budget.subCategoryId || null,
      month: budget.month,
      year: budget.year,
      amount: budget.amount,
    }, {
      onConflict: 'user_id,category_id,sub_category_id,month,year',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function deleteBudget(budgetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('id', budgetId);
  
  return !error;
}

// ============= Payment Modes =============

export async function getPaymentModes(): Promise<PaymentMode[]> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('payment_modes')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // If no payment modes exist, initialize with defaults (with concurrency protection)
  if (!data || data.length === 0) {
    await ensureDefaultPaymentModesInitialized(userId);
    
    // Re-fetch after initialization
    const { data: newModes, error: refetchError } = await supabase
      .from('payment_modes')
      .select('*')
      .eq('user_id', userId);
    
    if (refetchError) throw refetchError;
    
    return (newModes || []).map(pm => ({
      id: pm.id,
      name: pm.name,
      type: pm.type as PaymentMode['type'],
    }));
  }
  
  return data.map(pm => ({
    id: pm.id,
    name: pm.name,
    type: pm.type as PaymentMode['type'],
  }));
}

/**
 * Ensures default payment modes are initialized exactly once per user.
 * Uses in-memory locking to prevent concurrent initialization attempts.
 */
async function ensureDefaultPaymentModesInitialized(userId: string): Promise<void> {
  const cacheKey = `payment_modes_${userId}`;
  
  // If initialization is already in progress, wait for it
  const existingInit = initializationInProgress.get(cacheKey);
  if (existingInit) {
    await existingInit;
    return;
  }
  
  // Start initialization with lock
  const initPromise = initializeDefaultPaymentModesOnce(userId);
  initializationInProgress.set(cacheKey, initPromise);
  
  try {
    await initPromise;
  } finally {
    initializationInProgress.delete(cacheKey);
  }
}

/**
 * Actually performs the initialization, checking for existing data
 * to prevent duplicates.
 */
async function initializeDefaultPaymentModesOnce(userId: string): Promise<void> {
  // Double-check: another request may have created payment modes while we were waiting
  const { data: existingModes } = await supabase
    .from('payment_modes')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  
  if (existingModes && existingModes.length > 0) {
    // Payment modes already exist, don't overwrite
    return;
  }
  
  // Insert payment modes one by one to handle race conditions
  for (const pm of DEFAULT_PAYMENT_MODES) {
    const { data: existingMode } = await supabase
      .from('payment_modes')
      .select('id')
      .eq('user_id', userId)
      .eq('name', pm.name)
      .maybeSingle();
    
    if (!existingMode) {
      const { error } = await supabase
        .from('payment_modes')
        .insert({ user_id: userId, name: pm.name, type: pm.type || 'other' });
      
      // Ignore duplicate key errors (race condition handled)
      if (error && error.code !== '23505') {
        throw error;
      }
    }
  }
}

export async function addPaymentMode(mode: Omit<PaymentMode, 'id'>): Promise<string> {
  const userId = await getUserId();
  
  const { data, error } = await supabase
    .from('payment_modes')
    .insert({
      user_id: userId,
      name: mode.name,
      type: mode.type || 'other',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updatePaymentMode(modeId: string, updates: Partial<PaymentMode>): Promise<boolean> {
  const updateData: Record<string, unknown> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.type !== undefined) updateData.type = updates.type;
  
  const { error } = await supabase
    .from('payment_modes')
    .update(updateData)
    .eq('id', modeId);
  
  return !error;
}

export async function deletePaymentMode(modeId: string): Promise<boolean> {
  // Check if payment mode is used by any expenses
  const { data: expenses, error: checkError } = await supabase
    .from('expenses')
    .select('id')
    .eq('payment_mode_id', modeId)
    .limit(1);
  
  if (checkError) throw checkError;
  
  if (expenses && expenses.length > 0) {
    throw new Error('Cannot delete payment mode: it is used by existing expenses. Please reassign or delete those expenses first.');
  }
  
  const { error } = await supabase
    .from('payment_modes')
    .delete()
    .eq('id', modeId);
  
  if (error) throw error;
  return true;
}
