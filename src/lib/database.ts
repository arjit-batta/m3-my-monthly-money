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

// ============= Categories =============

export async function getCategories(): Promise<Category[]> {
  const userId = await getUserId();
  
  const { data: categories, error } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);
  
  if (error) throw error;
  
  // If no categories exist, initialize with defaults
  if (!categories || categories.length === 0) {
    await initializeDefaultCategories(userId);
    return getCategories();
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
    color: '', // Color is not stored in DB, use default or derive
    subCategories: (subCategories || [])
      .filter(sc => sc.category_id === cat.id)
      .map(sc => ({ id: sc.id, name: sc.name })),
  }));
}

async function initializeDefaultCategories(userId: string): Promise<void> {
  for (const cat of DEFAULT_CATEGORIES) {
    const { data: newCat, error: catError } = await supabase
      .from('categories')
      .insert({ user_id: userId, name: cat.name, icon: cat.icon })
      .select()
      .single();
    
    if (catError) throw catError;
    
    // Insert sub-categories
    const subCats = cat.subCategories.map(sc => ({
      category_id: newCat.id,
      user_id: userId,
      name: sc.name,
    }));
    
    const { error: subError } = await supabase
      .from('sub_categories')
      .insert(subCats);
    
    if (subError) throw subError;
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
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', categoryId);
  
  return !error;
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
  const { error } = await supabase
    .from('sub_categories')
    .delete()
    .eq('id', subCategoryId);
  
  return !error;
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
  
  // If no payment modes exist, initialize with defaults
  if (!data || data.length === 0) {
    await initializeDefaultPaymentModes(userId);
    return getPaymentModes();
  }
  
  return data.map(pm => ({
    id: pm.id,
    name: pm.name,
    type: pm.type as PaymentMode['type'],
  }));
}

async function initializeDefaultPaymentModes(userId: string): Promise<void> {
  const modes = DEFAULT_PAYMENT_MODES.map(pm => ({
    user_id: userId,
    name: pm.name,
    type: pm.type || 'other',
  }));
  
  const { error } = await supabase
    .from('payment_modes')
    .insert(modes);
  
  if (error) throw error;
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
  const { error } = await supabase
    .from('payment_modes')
    .delete()
    .eq('id', modeId);
  
  return !error;
}
