-- Add received_by_staff_id to supplies table
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS received_by_staff_id uuid REFERENCES public.employees(id);

-- Add delivery_number to supplies for tracking (EN-S/001 format)
ALTER TABLE public.supplies ADD COLUMN IF NOT EXISTS delivery_number serial;

-- Add trip_number to room_bookings for tracking (EN-R/001 format)  
ALTER TABLE public.room_bookings ADD COLUMN IF NOT EXISTS trip_number serial;