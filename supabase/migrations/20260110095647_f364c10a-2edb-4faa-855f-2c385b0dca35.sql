-- Add admin_secret_code column to employees table for admin reset functionality
ALTER TABLE public.employees ADD COLUMN admin_secret_code text;

-- Only admin employees will have this code set