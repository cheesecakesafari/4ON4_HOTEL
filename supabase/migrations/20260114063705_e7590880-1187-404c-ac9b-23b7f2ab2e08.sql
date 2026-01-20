-- Fix debt-clearing failure: allow split/amount payment_method strings while keeping legacy values
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_payment_method_check
CHECK (
  payment_method IS NULL
  OR payment_method = ANY (ARRAY['cash'::text, 'card'::text, 'mobile'::text, 'pending'::text])
  OR payment_method ~ '^(cash|mpesa|kcb|card|mobile)(:[0-9]+(\\.[0-9]+)?)(,(cash|mpesa|kcb|card|mobile):[0-9]+(\\.[0-9]+)?)*$'
);
