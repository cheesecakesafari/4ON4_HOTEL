-- Create pending_recoveries table for code recovery requests
CREATE TABLE public.pending_recoveries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  verification_code TEXT NOT NULL,
  new_staff_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '15 minutes')
);

-- Enable RLS
ALTER TABLE public.pending_recoveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can insert pending recoveries" 
ON public.pending_recoveries 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can view pending recoveries" 
ON public.pending_recoveries 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can delete pending recoveries" 
ON public.pending_recoveries 
FOR DELETE 
USING (true);