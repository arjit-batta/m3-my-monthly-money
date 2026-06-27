import { addMonths, addYears, format, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Subscription, SubscriptionCadence } from '@/lib/subscriptions';

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
 * Ensures a default "Subscriptions" category exists for the current user and
 * returns its id. Does NOT create or select any sub-category — the user
 * picks one in the expense form.
 */
export async function ensureSubscriptionsCategory(): Promise<string> {
  const userId = await getUserId();
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .eq('name', 'Subscriptions')
    .maybeSingle();
  if (existing) return existing.id;

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
  return created.id;
}

/**
 * Resolves the category to pre-fill: the subscription's category if set,
 * otherwise the default "Subscriptions" category (creating it if missing).
 * Never picks a sub-category — the user chooses one in the form.
 */
export async function resolveSubscriptionCategoryId(sub: Subscription): Promise<string> {
  if (sub.categoryId) return sub.categoryId;
  return ensureSubscriptionsCategory();
}

export async function advanceSubscription(sub: Subscription): Promise<void> {
  const next = advanceCadence(sub.nextRenewalDate, sub.cadence);
  const { error } = await supabase
    .from('subscriptions')
    .update({ next_renewal_date: next } as never)
    .eq('id', sub.id);
  if (error) throw error;
}

export async function dismissRenewal(sub: Subscription): Promise<void> {
  await advanceSubscription(sub);
}