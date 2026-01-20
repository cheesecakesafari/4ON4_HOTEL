-- Drop existing foreign key constraints and recreate with ON DELETE SET NULL
-- This allows deleting employees while preserving their historical records

-- Orders - waiter_id
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_waiter_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_waiter_id_fkey 
  FOREIGN KEY (waiter_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Orders - chef_id
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_chef_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_chef_id_fkey 
  FOREIGN KEY (chef_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Room bookings - staff_id
ALTER TABLE public.room_bookings DROP CONSTRAINT IF EXISTS room_bookings_staff_id_fkey;
ALTER TABLE public.room_bookings ADD CONSTRAINT room_bookings_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Conference bookings - staff_id
ALTER TABLE public.conference_bookings DROP CONSTRAINT IF EXISTS conference_bookings_staff_id_fkey;
ALTER TABLE public.conference_bookings ADD CONSTRAINT conference_bookings_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Laundry items - staff_id
ALTER TABLE public.laundry_items DROP CONSTRAINT IF EXISTS laundry_items_staff_id_fkey;
ALTER TABLE public.laundry_items ADD CONSTRAINT laundry_items_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES public.employees(id) ON DELETE SET NULL;

-- Expenses - staff_id (if exists)
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_staff_id_fkey;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_staff_id_fkey 
  FOREIGN KEY (staff_id) REFERENCES public.employees(id) ON DELETE SET NULL;