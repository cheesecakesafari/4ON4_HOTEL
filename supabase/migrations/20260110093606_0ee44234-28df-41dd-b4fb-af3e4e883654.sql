-- Add column to link related orders (kitchen order + direct order from same cart)
ALTER TABLE public.orders ADD COLUMN linked_order_id uuid REFERENCES public.orders(id);

-- Add index for faster lookups
CREATE INDEX idx_orders_linked_order_id ON public.orders(linked_order_id);