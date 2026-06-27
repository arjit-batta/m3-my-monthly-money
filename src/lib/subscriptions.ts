import { supabase } from '@/integrations/supabase/client';

export type SubscriptionCadence = 'monthly' | 'quarterly' | 'annual';
export type SubscriptionSource = string;
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled';

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  cadence: SubscriptionCadence;
  nextRenewalDate: string; // YYYY-MM-DD
  paymentModeId: string | null;
  categoryId: string | null;
  source: SubscriptionSource;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionInput {
  name: string;
  amount: number;
  cadence: SubscriptionCadence;
  nextRenewalDate: string;
  paymentModeId: string | null;
  categoryId: string | null;
  source: SubscriptionSource;
  status: SubscriptionStatus;
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

function mapRow(row: {
  id: string;
  name: string;
  amount: number | string;
  cadence: string;
  next_renewal_date: string;
  payment_mode_id: string | null;
  category_id: string | null;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
}): Subscription {
  return {
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    cadence: row.cadence as SubscriptionCadence,
    nextRenewalDate: row.next_renewal_date,
    paymentModeId: row.payment_mode_id,
    categoryId: row.category_id,
    source: row.source as SubscriptionSource,
    status: row.status as SubscriptionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getSubscriptions(): Promise<Subscription[]> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('next_renewal_date', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

export async function addSubscription(input: SubscriptionInput): Promise<string> {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      name: input.name,
      amount: input.amount,
      cadence: input.cadence,
      next_renewal_date: input.nextRenewalDate,
      payment_mode_id: input.paymentModeId,
      category_id: input.categoryId,
      source: input.source,
      status: input.status,
    })
    .select()
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateSubscription(id: string, input: SubscriptionInput): Promise<boolean> {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      name: input.name,
      amount: input.amount,
      cadence: input.cadence,
      next_renewal_date: input.nextRenewalDate,
      payment_mode_id: input.paymentModeId,
      category_id: input.categoryId,
      source: input.source,
      status: input.status,
    } as never)
    .eq('id', id);
  if (error) throw error;
  return true;
}

export async function deleteSubscription(id: string): Promise<boolean> {
  const { error } = await supabase.from('subscriptions').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export function monthlyBurnFor(sub: Pick<Subscription, 'amount' | 'cadence'>): number {
  switch (sub.cadence) {
    case 'monthly':
      return sub.amount;
    case 'quarterly':
      return (sub.amount * 4) / 12;
    case 'annual':
      return sub.amount / 12;
  }
}

export function totalMonthlyBurn(subs: Subscription[]): number {
  return subs
    .filter((s) => s.status === 'active')
    .reduce((sum, s) => sum + monthlyBurnFor(s), 0);
}

export function totalAnnualBurn(subs: Subscription[]): number {
  return totalMonthlyBurn(subs) * 12;
}