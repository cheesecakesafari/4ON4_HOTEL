-- Create menu_combos table for combined menu items (like Rice+Beef)
CREATE TABLE public.menu_combos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.menu_combos ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Allow all access for authenticated users" 
ON public.menu_combos 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add category column to menu_items for drinks/snacks/others
ALTER TABLE public.menu_items 
DROP COLUMN IF EXISTS category;

ALTER TABLE public.menu_items 
ADD COLUMN category TEXT NOT NULL DEFAULT 'others' 
CHECK (category IN ('drinks', 'snacks', 'others'));

-- Add requires_kitchen column to track if item needs kitchen prep
ALTER TABLE public.menu_items 
ADD COLUMN requires_kitchen BOOLEAN NOT NULL DEFAULT false;

-- Enable realtime for menu_combos
ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_combos;

-- Create trigger for updated_at on menu_combos
CREATE TRIGGER update_menu_combos_updated_at
BEFORE UPDATE ON public.menu_combos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();