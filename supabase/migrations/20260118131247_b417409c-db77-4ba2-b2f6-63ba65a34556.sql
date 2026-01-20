-- Add category column to bar_inventory so items can be categorized for ordering
ALTER TABLE public.bar_inventory 
ADD COLUMN category text NOT NULL DEFAULT 'drinks';