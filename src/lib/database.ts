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

/**
 * Clears all in-memory caches. Call this on logout to ensure
 * complete isolation between users.
 */
export function clearInMemoryCaches(): void {
  initializationInProgress.clear();
}

// ============= Categories =============

export async function getCategories(): Promise<Category[]> {
  const userId = await getUserId();
  
  // Check if categories exist
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  
  if (error) throw error;
  
  // If no categories exist, initialize with defaults (with concurrency protection)
  if (!categories || categories.length === 0) {
    await ensureDefaultCategoriesInitialized(userId);
    
    // Re-fetch after initialization
    const { data: newCategories, error: refetchError } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });
    
    if (refetchError) throw refetchError;
    
    const { data: subCategories } = await supabase
      .from('sub_categories')
      .select('*')
      .eq('user_id', userId)
      .order('order_index', { ascending: true });
    
    return (newCategories || []).map(cat => ({
      id: cat.id,
      name: cat.name,
      icon: cat.icon,
      color: '',
      orderIndex: cat.order_index,
      subCategories: (subCategories || [])
        .filter(sc => sc.category_id === cat.id)
        .map(sc => ({ id: sc.id, name: sc.name, orderIndex: sc.order_index })),
    }));
  }
  
  // Fetch sub-categories for each category
  const { data: subCategories, error: subError } = await supabase
    .from('sub_categories')
    .select('*')
    .eq('user_id', userId)
    .order('order_index', { ascending: true });
  
  if (subError) throw subError;
  
  // Map to Category type with nested sub-categories
  return categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    icon: cat.icon,
    color: '',
    orderIndex: cat.order_index,
    subCategories: (subCategories || [])
      .filter(sc => sc.category_id === cat.id)
      .map(sc => ({ id: sc.id, name: sc.name, orderIndex: sc.order_index })),
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
  let categoryOrderIndex = 0;
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
      // Insert new category with order_index
      const { data: newCat, error: catError } = await supabase
        .from('categories')
        .insert({ user_id: userId, name: cat.name, icon: cat.icon, order_index: categoryOrderIndex })
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
    
    categoryOrderIndex++;
    
    // Insert sub-categories (skip if they already exist)
    let subOrderIndex = 0;
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
          .insert({ category_id: categoryId, user_id: userId, name: sc.name, order_index: subOrderIndex });
        
        // Ignore duplicate key errors
        if (subError && subError.code !== '23505') {
          throw subError;
        }
      }
      subOrderIndex++;
    }
  }
}

export async function addCategory(category: { name: string; icon: string; subCategories: SubCategory[] }): Promise<string> {
  const userId = await getUserId();
  
  // Get max order_index for categories
  const { data: maxOrderData } = await supabase
    .from('categories')
    .select('order_index')
    .eq('user_id', userId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single();
  
  const newOrderIndex = (maxOrderData?.order_index ?? -1) + 1;
  
  const { data: newCat, error: catError } = await supabase
    .from('categories')
    .insert({ user_id: userId, name: category.name, icon: category.icon, order_index: newOrderIndex })
    .select()
    .single();
  
  if (catError) throw catError;
  
  // Insert sub-categories with order_index
  if (category.subCategories.length > 0) {
    const subCats = category.subCategories.map((sc, index) => ({
      category_id: newCat.id,
      user_id: userId,
      name: sc.name,
      order_index: index,
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
  
  // Get max order_index for sub-categories in this category
  const { data: maxOrderData } = await supabase
    .from('sub_categories')
    .select('order_index')
    .eq('category_id', categoryId)
    .order('order_index', { ascending: false })
    .limit(1)
    .single();
  
  const newOrderIndex = (maxOrderData?.order_index ?? -1) + 1;
  
  const { data, error } = await supabase
    .from('sub_categories')
    .insert({ category_id: categoryId, user_id: userId, name, order_index: newOrderIndex })
    .select()
    .single();
  
  if (error) throw error;
  return data.id;
}

// ============= Reordering =============

/**
 * Swap order_index between two categories
 */
export async function swapCategoryOrder(categoryId1: string, categoryId2: string): Promise<boolean> {
  const userId = await getUserId();
  
  // Get current order indices
  const { data: cat1 } = await supabase
    .from('categories')
    .select('order_index')
    .eq('id', categoryId1)
    .eq('user_id', userId)
    .single();
  
  const { data: cat2 } = await supabase
    .from('categories')
    .select('order_index')
    .eq('id', categoryId2)
    .eq('user_id', userId)
    .single();
  
  if (!cat1 || !cat2) return false;
  
  // Swap order indices
  const { error: err1 } = await supabase
    .from('categories')
    .update({ order_index: cat2.order_index })
    .eq('id', categoryId1);
  
  if (err1) throw err1;
  
  const { error: err2 } = await supabase
    .from('categories')
    .update({ order_index: cat1.order_index })
    .eq('id', categoryId2);
  
  if (err2) throw err2;
  
  return true;
}

/**
 * Swap order_index between two sub-categories within the same category
 */
export async function swapSubCategoryOrder(subCategoryId1: string, subCategoryId2: string): Promise<boolean> {
  // Get current order indices
  const { data: sub1 } = await supabase
    .from('sub_categories')
    .select('order_index, category_id')
    .eq('id', subCategoryId1)
    .single();
  
  const { data: sub2 } = await supabase
    .from('sub_categories')
    .select('order_index, category_id')
    .eq('id', subCategoryId2)
    .single();
  
  if (!sub1 || !sub2) return false;
  
  // Ensure they're in the same category
  if (sub1.category_id !== sub2.category_id) return false;
  
  // Swap order indices
  const { error: err1 } = await supabase
    .from('sub_categories')
    .update({ order_index: sub2.order_index })
    .eq('id', subCategoryId1);
  
  if (err1) throw err1;
  
  const { error: err2 } = await supabase
    .from('sub_categories')
    .update({ order_index: sub1.order_index })
    .eq('id', subCategoryId2);
  
  if (err2) throw err2;
  
  return true;
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

/**
 * Reassign expenses from one category/sub-category to another.
 * Used before deleting a category or sub-category that has expenses.
 */
export async function reassignExpenses(
  fromCategoryId: string,
  fromSubCategoryId: string | null,
  toCategoryId: string,
  toSubCategoryId: string
): Promise<number> {
  const userId = await getUserId();
  
  // Build the query to find matching expenses
  let query = supabase
    .from('expenses')
    .update({ 
      category_id: toCategoryId, 
      sub_category_id: toSubCategoryId 
    })
    .eq('user_id', userId)
    .eq('category_id', fromCategoryId);
  
  // If sub-category is specified, filter by it; otherwise reassign all expenses in the category
  if (fromSubCategoryId) {
    query = query.eq('sub_category_id', fromSubCategoryId);
  }
  
  const { error, count } = await query.select();
  
  if (error) throw error;
  return count || 0;
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

/**
 * Ensure budgets exist for the given month/year by copying from the most recent
 * prior month that has budgets. Idempotent: does nothing if budgets already exist.
 * Returns true if budgets were copied, false otherwise.
 */
export async function ensureBudgetsForMonth(month: number, year: number): Promise<boolean> {
  const userId = await getUserId();

  // Check if budgets already exist for this month
  const { data: existing, error: existingErr } = await supabase
    .from('budgets')
    .select('id')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('year', year)
    .limit(1);

  if (existingErr) throw existingErr;
  if (existing && existing.length > 0) return false;

  // Find the most recent prior month with budgets
  const { data: priorMonths, error: priorErr } = await supabase
    .from('budgets')
    .select('month, year')
    .eq('user_id', userId)
    .or(`year.lt.${year},and(year.eq.${year},month.lt.${month})`)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1);

  if (priorErr) throw priorErr;
  if (!priorMonths || priorMonths.length === 0) return false;

  const { month: srcMonth, year: srcYear } = priorMonths[0];

  const { data: srcBudgets, error: srcErr } = await supabase
    .from('budgets')
    .select('category_id, sub_category_id, amount')
    .eq('user_id', userId)
    .eq('month', srcMonth)
    .eq('year', srcYear);

  if (srcErr) throw srcErr;
  if (!srcBudgets || srcBudgets.length === 0) return false;

  const rows = srcBudgets.map(b => ({
    user_id: userId,
    category_id: b.category_id,
    sub_category_id: b.sub_category_id,
    month,
    year,
    amount: b.amount,
  }));

  const { error: insertErr } = await supabase
    .from('budgets')
    .upsert(rows, { onConflict: 'user_id,category_id,sub_category_id,month,year' });

  if (insertErr) throw insertErr;
  return true;
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
