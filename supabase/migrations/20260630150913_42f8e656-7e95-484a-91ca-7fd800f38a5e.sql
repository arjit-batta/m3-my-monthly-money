
CREATE TABLE public.voice_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  keyword TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sub_category_id UUID REFERENCES public.sub_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_mappings_user_keyword_unique UNIQUE (user_id, keyword)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_mappings TO authenticated;
GRANT ALL ON public.voice_mappings TO service_role;

ALTER TABLE public.voice_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voice mappings"
  ON public.voice_mappings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own voice mappings"
  ON public.voice_mappings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own voice mappings"
  ON public.voice_mappings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own voice mappings"
  ON public.voice_mappings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_voice_mappings_updated_at
  BEFORE UPDATE ON public.voice_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
