-- Make menu_item_id nullable to allow combos (which don't have a menu_items entry)
ALTER TABLE public.order_items ALTER COLUMN menu_item_id DROP NOT NULL;