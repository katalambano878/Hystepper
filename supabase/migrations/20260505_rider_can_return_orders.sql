-- Allow riders to mark their assigned orders as 'returned' (the
-- "Could not deliver" outcome) in addition to delivered/completed.
-- The previous policy only permitted delivered/completed, which caused
-- "new row violates row-level security policy" when riders chose
-- "Could not deliver (returned)" in the rider UI.

DROP POLICY IF EXISTS "Riders can update status of their assigned orders" ON public.orders;

CREATE POLICY "Riders can update status of their assigned orders"
ON public.orders
FOR UPDATE
USING (rider_id = auth.uid())
WITH CHECK (
  rider_id = auth.uid()
  AND status = ANY (ARRAY['delivered'::order_status, 'completed'::order_status, 'returned'::order_status])
);
