
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_source_check;
ALTER TABLE public.subscriptions ALTER COLUMN source DROP NOT NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS source_other text;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_source_check CHECK (source IS NULL OR source = ANY (ARRAY['app_store'::text, 'play_store'::text, 'upi_autopay'::text, 'card_mandate'::text, 'provider_direct'::text, 'other'::text]));
UPDATE public.subscriptions SET source = NULL WHERE source NOT IN ('app_store','play_store','upi_autopay','card_mandate','provider_direct','other');
