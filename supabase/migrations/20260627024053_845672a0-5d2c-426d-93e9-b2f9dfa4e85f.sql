
CREATE TABLE public.card_strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_mode_id UUID NOT NULL REFERENCES public.payment_modes(id) ON DELETE CASCADE,
  tags TEXT[] NOT NULL DEFAULT '{}',
  keep_alive BOOLEAN NOT NULL DEFAULT false,
  keep_alive_cadence_days INTEGER NOT NULL DEFAULT 30,
  billing_cycle_start_day INTEGER,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, payment_mode_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_strategies TO authenticated;
GRANT ALL ON public.card_strategies TO service_role;

ALTER TABLE public.card_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own card strategies"
  ON public.card_strategies FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own card strategies"
  ON public.card_strategies FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own card strategies"
  ON public.card_strategies FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own card strategies"
  ON public.card_strategies FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_card_strategies_updated_at
  BEFORE UPDATE ON public.card_strategies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('monthly','quarterly','annual')),
  next_renewal_date DATE NOT NULL,
  payment_mode_id UUID REFERENCES public.payment_modes(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('card','upi','app_store','web')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own subscriptions"
  ON public.subscriptions FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
