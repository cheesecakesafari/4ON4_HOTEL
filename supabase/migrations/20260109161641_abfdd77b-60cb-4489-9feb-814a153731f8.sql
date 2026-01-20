-- Create pending_registrations table for email verification flow
CREATE TABLE public.pending_registrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  departments TEXT[] NOT NULL,
  verification_code TEXT NOT NULL,
  staff_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '15 minutes')
);

-- Enable RLS
ALTER TABLE public.pending_registrations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view pending registrations (for verification)
CREATE POLICY "Anyone can view pending registrations"
ON public.pending_registrations
FOR SELECT
USING (true);

-- Allow anyone to insert pending registrations
CREATE POLICY "Anyone can insert pending registrations"
ON public.pending_registrations
FOR INSERT
WITH CHECK (true);

-- Allow anyone to delete pending registrations (after verification)
CREATE POLICY "Anyone can delete pending registrations"
ON public.pending_registrations
FOR DELETE
USING (true);

-- Create index for faster lookup by verification code
CREATE INDEX idx_pending_registrations_verification_code ON public.pending_registrations(verification_code);

-- Create index for faster lookup by staff_code
CREATE INDEX idx_pending_registrations_staff_code ON public.pending_registrations(staff_code);