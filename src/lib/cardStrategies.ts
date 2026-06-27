import { supabase } from '@/integrations/supabase/client';

export interface CardStrategy {
  id: string;
  paymentModeId: string;
  tags: string[];
  keepAlive: boolean;
  keepAliveCadenceDays: number;
  note: string | null;
}

export interface CardStrategyInput {
  tags: string[];
  keepAlive: boolean;
  keepAliveCadenceDays: number;
  note: string | null;
}

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

export async function getCardStrategy(paymentModeId: string): Promise<CardStrategy | null> {
  const { data, error } = await supabase
    .from('card_strategies')
    .select('*')
    .eq('payment_mode_id', paymentModeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    paymentModeId: data.payment_mode_id,
    tags: data.tags ?? [],
    keepAlive: data.keep_alive,
    keepAliveCadenceDays: data.keep_alive_cadence_days,
    note: data.note,
  };
}

export async function upsertCardStrategy(
  paymentModeId: string,
  input: CardStrategyInput,
): Promise<void> {
  const userId = await getUserId();
  const { error } = await supabase
    .from('card_strategies')
    .upsert(
      {
        user_id: userId,
        payment_mode_id: paymentModeId,
        tags: Array.from(input.tags ?? []).map((t) => String(t)),
        keep_alive: input.keepAlive,
        keep_alive_cadence_days: input.keepAliveCadenceDays,
        note: input.note,
      },
      { onConflict: 'user_id,payment_mode_id' },
    );
  if (error) throw error;
}

export const SUGGESTED_CARD_TAGS = [
  'everyday',
  'food',
  'travel',
  'online',
  'vouchers',
  'lounge',
  'fuel',
  'keep-alive',
];