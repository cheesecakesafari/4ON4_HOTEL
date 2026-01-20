-- Make user_id nullable and remove the foreign key constraint
ALTER TABLE public.hotels ALTER COLUMN user_id DROP NOT NULL;

-- Also make email nullable since we removed it from registration
ALTER TABLE public.hotels ALTER COLUMN email DROP NOT NULL;