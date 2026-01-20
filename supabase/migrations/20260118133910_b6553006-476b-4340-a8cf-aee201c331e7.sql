-- Add bar_admin to the department_role enum
ALTER TYPE public.department_role ADD VALUE IF NOT EXISTS 'bar_admin';