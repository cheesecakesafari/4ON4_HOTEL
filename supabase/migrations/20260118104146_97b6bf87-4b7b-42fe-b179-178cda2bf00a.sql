-- Add 'bar' to the department_role enum
ALTER TYPE public.department_role ADD VALUE IF NOT EXISTS 'bar';

-- Create bar_menu_items table
CREATE TABLE public.bar_menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'drinks',
  price NUMERIC NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bar_menu_items ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all access for authenticated users"
ON public.bar_menu_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Create bar_inventory table (tracks stock with cost pricing for profit calculation)
CREATE TABLE public.bar_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_menu_item_id UUID REFERENCES public.bar_menu_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_price NUMERIC NOT NULL DEFAULT 0,
  supplier_name TEXT,
  received_by_staff_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bar_inventory ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all access for authenticated users"
ON public.bar_inventory
FOR ALL
USING (true)
WITH CHECK (true);

-- Create bar_orders table
CREATE TABLE public.bar_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL,
  status TEXT NOT NULL DEFAULT 'pending',
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  is_debt BOOLEAN NOT NULL DEFAULT false,
  debtor_name TEXT,
  notes TEXT,
  staff_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bar_orders ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all access for authenticated users"
ON public.bar_orders
FOR ALL
USING (true)
WITH CHECK (true);

-- Create bar_order_items table
CREATE TABLE public.bar_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bar_order_id UUID NOT NULL REFERENCES public.bar_orders(id) ON DELETE CASCADE,
  bar_menu_item_id UUID REFERENCES public.bar_menu_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bar_order_items ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Allow all access for authenticated users"
ON public.bar_order_items
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for bar_menu_items updated_at
CREATE TRIGGER update_bar_menu_items_updated_at
BEFORE UPDATE ON public.bar_menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for bar_inventory updated_at
CREATE TRIGGER update_bar_inventory_updated_at
BEFORE UPDATE ON public.bar_inventory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger for bar_orders updated_at
CREATE TRIGGER update_bar_orders_updated_at
BEFORE UPDATE ON public.bar_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();