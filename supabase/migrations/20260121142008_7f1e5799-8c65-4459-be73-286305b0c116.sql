-- Add order_index column to categories table
ALTER TABLE public.categories 
ADD COLUMN order_index integer NOT NULL DEFAULT 0;

-- Add order_index column to sub_categories table
ALTER TABLE public.sub_categories 
ADD COLUMN order_index integer NOT NULL DEFAULT 0;

-- Initialize order_index for existing categories based on created_at order
WITH ranked_categories AS (
  SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) - 1 as new_order
  FROM public.categories
)
UPDATE public.categories c
SET order_index = rc.new_order
FROM ranked_categories rc
WHERE c.id = rc.id;

-- Initialize order_index for existing sub_categories based on created_at order within each category
WITH ranked_subcategories AS (
  SELECT id, category_id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY created_at, id) - 1 as new_order
  FROM public.sub_categories
)
UPDATE public.sub_categories sc
SET order_index = rsc.new_order
FROM ranked_subcategories rsc
WHERE sc.id = rsc.id;

-- Create index for efficient ordering queries
CREATE INDEX idx_categories_user_order ON public.categories(user_id, order_index);
CREATE INDEX idx_sub_categories_category_order ON public.sub_categories(category_id, order_index);