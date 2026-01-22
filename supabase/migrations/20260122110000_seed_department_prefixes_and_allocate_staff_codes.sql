-- Step 3: Seed department prefixes per hotel and add staff-code allocator

-- 1) Add hotel + single-department fields to pending registrations
ALTER TABLE public.pending_registrations
ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS department public.department_role;

-- Make staff_code optional (we will allocate on verification)
ALTER TABLE public.pending_registrations
  DROP CONSTRAINT IF EXISTS pending_registrations_staff_code_key;

ALTER TABLE public.pending_registrations
  ALTER COLUMN staff_code DROP NOT NULL;

-- 2) Seed per-hotel department settings with your prefix map
-- Kitchen=K, Rooms=H, Conference=C, Admin=AD, Accounts=AC, Restaurant=R, Bar=B, Bar Admin=BA
INSERT INTO public.hotel_department_settings (hotel_id, department, enabled, code_prefix, next_code)
SELECT
  h.id AS hotel_id,
  d.department,
  true AS enabled,
  d.code_prefix,
  1 AS next_code
FROM public.hotels h
CROSS JOIN (
  SELECT 'restaurant'::public.department_role AS department, 'R'::varchar(2) AS code_prefix
  UNION ALL SELECT 'kitchen'::public.department_role, 'K'
  UNION ALL SELECT 'rooms'::public.department_role, 'H'
  UNION ALL SELECT 'conference'::public.department_role, 'C'
  UNION ALL SELECT 'admin'::public.department_role, 'AD'
  UNION ALL SELECT 'accountant'::public.department_role, 'AC'
  UNION ALL SELECT 'bar'::public.department_role, 'B'
  UNION ALL SELECT 'bar_admin'::public.department_role, 'BA'
) d
ON CONFLICT (hotel_id, department)
DO NOTHING;

-- 3) Allocate next staff code per hotel + department (e.g., K01, AD12)
CREATE OR REPLACE FUNCTION public.allocate_staff_code(
  p_hotel_id uuid,
  p_department public.department_role
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  settings_row public.hotel_department_settings%ROWTYPE;
  allocated_code text;
BEGIN
  SELECT *
  INTO settings_row
  FROM public.hotel_department_settings
  WHERE hotel_id = p_hotel_id
    AND department = p_department
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No department settings for hotel %, department %', p_hotel_id, p_department;
  END IF;

  IF settings_row.enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Department % is disabled for hotel %', p_department, p_hotel_id;
  END IF;

  IF settings_row.next_code IS NULL OR settings_row.next_code < 1 OR settings_row.next_code > 99 THEN
    RAISE EXCEPTION 'No codes available for hotel %, department % (next_code=%)', p_hotel_id, p_department, settings_row.next_code;
  END IF;

  allocated_code := settings_row.code_prefix || lpad(settings_row.next_code::text, 2, '0');

  UPDATE public.hotel_department_settings
  SET next_code = settings_row.next_code + 1
  WHERE id = settings_row.id;

  RETURN allocated_code;
END;
$$;
