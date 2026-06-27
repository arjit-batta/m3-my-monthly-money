import { addMonths, addYears, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Subscription, SubscriptionCadence } from '@/lib/subscriptions';
import { addExpense } from '@/lib/database';

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export function advanceCadence(dateISO: string, cadence: SubscriptionCadence): string {
  const d = parseISO(dateISO);
  let next: Date;
  switch (cadence) {
    case 'monthly':
      next = addMonths(d, 1);
      break;
    case 'quarterly':
      next = addMonths(d, 3);
      break;
    case 'annual':
      next = addYears(d, 1);
      break;
  }
  return format(next, 'yyyy-MM-dd');
}

export function isDueToday(sub: Subscription, today: Date = new Date()): boolean {
  if (sub.status !== 'active') return false;
  const todayStr = format(today, 'yyyy-MM-dd');
  return sub.nextRenewalDate <= todayStr;
}

/**
 * Ensures a usable (categoryId, subCategoryId) pair for logging a subscription expense.
 * - If the subscription has a category set, picks its first sub-category (creating
 *   a "Subscription" sub-category if it has none).
 * - Otherwise, finds or creates a default "Subscriptions" category with a
 *   "General" sub-category.
 */
async function resolveCategoryForSubscription(
  sub: Subscription
): Promise<{ categoryId: string; subCategoryId: string }> {
  const userId = await getUserId();

  let categoryId = sub.categoryId;

  if (!categoryId) {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .eq('name', 'Subscriptions')
      .maybeSingle();
    if (existing) {
      categoryId = existing.id;
    } else {
      const { data: maxOrder } = await supabase
        .from('categories')
        .select('order_index')
        .eq('user_id', userId)
        .order('order_index', { ascending: false })
        .limit(1)
        .maybeSingle();
      const orderIndex = (maxOrder?.order_index ?? -1) + 1;
      const { data: created, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: 'Subscriptions',
          icon: '🔁',
          order_index: orderIndex,
        })
        .select('id')
        .single();
      if (error) throw error;
      categoryId = created.id;
    }
  }

  // Find a sub-category under categoryId
  const { data: existingSubs } = await supabase
    .from('sub_categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('category_id', categoryId!)
    .order('order_index', { ascending: true });

  if (existingSubs && existingSubs.length > 0) {
    return { categoryId: categoryId!, subCategoryId: existingSubs[0].id };
  }

  const subName = sub.categoryId ? 'Subscription' : 'General';
  const { data: newSub, error: subErr } = await supabase
    .from('sub_categories')
    .insert({
      user_id: userId,
      category_id: categoryId!,
      name: subName,
      order_index: 0,
    })
    .select('id')
    .single();
  if (subErr) throw subErr;
  return { categoryId: categoryId!, subCategoryId: newSub.id };
}

async function advanceSubscription(sub: Subscription): Promise<void> {
  const next = advanceCadence(sub.nextRenewalDate, sub.cadence);
  const { error } = await supabase
    .from('subscriptions')
    .update({ next_renewal_date: next } as never)
    .eq('id', sub.id);
  if (error) throw error;
}

export async function confirmRenewal(sub: Subscription): Promise<void> {
  if (!sub.paymentModeId) {
    throw new Error('Subscription has no payment mode set.');
  }
  const { categoryId, subCategoryId } = await resolveCategoryForSubscription(sub);
  await addExpense({
    amount: sub.amount,
    date: sub.nextRenewalDate,
    categoryId,
    subCategoryId,
    paymentModeId: sub.paymentModeId,
    notes: `${sub.name} (subscription)`,
  });
  await advanceSubscription(sub);
}

export async function dismissRenewal(sub: Subscription): Promise<void> {
  await advanceSubscription(sub);
}