-- Add selling_price column to bar_inventory so inventory items can be sold directly
ALTER TABLE public.bar_inventory 
ADD COLUMN selling_price numeric NOT NULL DEFAULT 0;