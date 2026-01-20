-- Create hotels table for multi-tenant support
CREATE TABLE public.hotels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hotel_code VARCHAR(2) NOT NULL UNIQUE,
  hotel_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT hotel_code_format CHECK (hotel_code ~ '^[0-9]{2}$')
);

-- Add hotel_id to employees table
ALTER TABLE public.employees 
ADD COLUMN hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE;

-- Drop old unique constraint on login_number and create new composite unique constraint
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_login_number_key;
ALTER TABLE public.employees ADD CONSTRAINT employees_hotel_login_unique UNIQUE (hotel_id, login_number);

-- Enable RLS on hotels
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;

-- RLS policies for hotels - hotel owners can manage their own hotel
CREATE POLICY "Hotel owners can view their hotel" 
ON public.hotels FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Hotel owners can update their hotel" 
ON public.hotels FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view hotel by code for login" 
ON public.hotels FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert hotels" 
ON public.hotels FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Update employees RLS to include hotel isolation
DROP POLICY IF EXISTS "Allow all access for authenticated users " ON public.employees;

CREATE POLICY "Anyone can view employees for login" 
ON public.employees FOR SELECT 
USING (true);

CREATE POLICY "Anyone can insert employees" 
ON public.employees FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update employees" 
ON public.employees FOR UPDATE 
USING (true);

-- Trigger for hotels updated_at
CREATE TRIGGER update_hotels_updated_at
BEFORE UPDATE ON public.hotels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();