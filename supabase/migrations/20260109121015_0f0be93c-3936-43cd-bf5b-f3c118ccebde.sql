-- Drop existing insert policy and create one that allows public registration
DROP POLICY IF EXISTS "Anyone can register a hotel" ON public.hotels;

CREATE POLICY "Anyone can register a hotel"
ON public.hotels
FOR INSERT
WITH CHECK (true);