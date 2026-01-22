-- Allow hotel creation without Supabase Auth users (domain acts as tenant identifier)

ALTER TABLE public.hotels
  ALTER COLUMN user_id DROP NOT NULL;

-- Keep RLS as-is; hotels will be created via edge functions using service role.
