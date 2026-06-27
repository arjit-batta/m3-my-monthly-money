import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  isPremium: boolean;
}

export async function getMyProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, is_premium')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { id: user.id, isPremium: false };
  return { id: data.id, isPremium: !!data.is_premium };
}