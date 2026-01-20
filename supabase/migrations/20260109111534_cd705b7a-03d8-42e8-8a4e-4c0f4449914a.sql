-- Add columns to store permanent item details as receipt data
ALTER TABLE public.order_items 
ADD COLUMN IF NOT EXISTS item_name text,
ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'item';

-- Update existing order_items with current menu item names (for historical data)
UPDATE public.order_items oi
SET item_name = mi.name,
    item_type = 'item'
FROM public.menu_items mi
WHERE oi.menu_item_id = mi.id AND oi.item_name IS NULL;

-- Also update from menu_combos if applicable
UPDATE public.order_items oi
SET item_name = mc.name,
    item_type = 'combo'
FROM public.menu_combos mc
WHERE oi.menu_item_id = mc.id AND oi.item_name IS NULL;