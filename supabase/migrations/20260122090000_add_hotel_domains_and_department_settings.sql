-- Step 2: Domain mapping + per-hotel department settings + widen staff codes

-- 1) Map hotels -> multiple hostnames
CREATE TABLE public.hotel_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT hotel_domains_hostname_not_empty CHECK (length(trim(hostname)) > 0)
);

-- Fast lookups by hostname + hotel_id (case-insensitive hostname)
CREATE UNIQUE INDEX hotel_domains_hostname_lower_uq
  ON public.hotel_domains (lower(hostname));

CREATE INDEX hotel_domains_hotel_id_idx
  ON public.hotel_domains (hotel_id);

ALTER TABLE public.hotel_domains ENABLE ROW LEVEL SECURITY;

-- For now: public read is OK for domain->hotel lookup
CREATE POLICY "Anyone can view hotel domains"
  ON public.hotel_domains
  FOR SELECT
  USING (true);

-- 2) Per-hotel department settings (enabled + code prefix + 2-digit counter)
CREATE TABLE public.hotel_department_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  department public.department_role NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  code_prefix VARCHAR(2) NOT NULL,
  next_code INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT hotel_department_settings_unique UNIQUE (hotel_id, department),
  CONSTRAINT hotel_department_settings_code_prefix_format CHECK (code_prefix ~ '^[A-Z]{1,2}$'),
  CONSTRAINT hotel_department_settings_next_code_min CHECK (next_code >= 1),
  CONSTRAINT hotel_department_settings_next_code_max CHECK (next_code <= 99)
);

CREATE INDEX hotel_department_settings_hotel_id_idx
  ON public.hotel_department_settings (hotel_id);

CREATE INDEX hotel_department_settings_department_idx
  ON public.hotel_department_settings (department);

ALTER TABLE public.hotel_department_settings ENABLE ROW LEVEL SECURITY;

-- For now: allow read so the UI can know which departments are enabled
CREATE POLICY "Anyone can view hotel department settings"
  ON public.hotel_department_settings
  FOR SELECT
  USING (true);

CREATE TRIGGER update_hotel_department_settings_updated_at
BEFORE UPDATE ON public.hotel_department_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Allow up to 4 chars in employees.login_number (supports AD12)
ALTER TABLE public.employees
  ALTER COLUMN login_number TYPE VARCHAR(4);
