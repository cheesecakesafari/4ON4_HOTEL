-- Create supplies table (replaces expenses concept, includes tokens as weekly supplies)
CREATE TABLE public.supplies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  supplier_name TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'pcs',
  amount_to_pay NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  paid_by_staff_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  cleared_by_staff_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  payment_date DATE,
  period TEXT NOT NULL DEFAULT 'daily',
  department TEXT NOT NULL DEFAULT 'general',
  category TEXT NOT NULL DEFAULT 'supplies',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.supplies ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all access for authenticated users"
ON public.supplies
FOR ALL
USING (true)
WITH CHECK (true);

-- Create employee_compensations table
CREATE TABLE public.employee_compensations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT,
  description TEXT,
  added_by_staff_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_compensations ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all access for authenticated users"
ON public.employee_compensations
FOR ALL
USING (true)
WITH CHECK (true);

-- Create cash_transfers table for tracking cash to mpesa/kcb transfers
CREATE TABLE public.cash_transfers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_account TEXT NOT NULL,
  to_account TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  staff_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_transfers ENABLE ROW LEVEL SECURITY;

-- RLS policy
CREATE POLICY "Allow all access for authenticated users"
ON public.cash_transfers
FOR ALL
USING (true)
WITH CHECK (true);

-- Add debtor_name to room_bookings for pending payments
ALTER TABLE public.room_bookings ADD COLUMN IF NOT EXISTS debtor_name TEXT;