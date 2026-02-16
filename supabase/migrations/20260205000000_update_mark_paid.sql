-- Update mark_order_paid to be more robust and ensure status processing
CREATE OR REPLACE FUNCTION mark_order_paid(order_ref TEXT, moolre_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_order orders;
BEGIN
  -- 1. Try to update the order
  -- We update if payment_status is not 'paid' OR status is 'pending'/'awaiting_payment'
  UPDATE orders
  SET 
    payment_status = 'paid',
    status = CASE 
        WHEN status = 'pending' THEN 'processing'::order_status
        WHEN status = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status -- Keep existing status if it's already advanced (e.g. shipped)
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || 
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
  WHERE order_number = order_ref
    -- We allow update even if already paid, just to ensure status is correct, but usually idempotent
  RETURNING * INTO updated_order;

  -- 2. Reduce Stock (Idempotency needed: don't reduce twice)
  -- Logic: If we just changed payment_status from something else TO 'paid', reduce stock.
  -- But we can't easily check previous value here without SELECT first.
  -- SIMPLIFICATION: We assume this function is called ONCE per successful payment callback.
  -- To be safe, we could check if stock was already reduced? Hard to track.
  -- For now, we'll assume the callback is legitimate.
  
  IF updated_order IS NOT NULL THEN
      -- Only reduce quantity if we haven't flagged it as reduced yet (using metadata)
      IF (updated_order.metadata->>'stock_reduced') IS NULL THEN
          
          UPDATE products p
          SET quantity = p.quantity - oi.quantity
          FROM order_items oi
          WHERE oi.order_id = updated_order.id
            AND oi.product_id = p.id;
            
          -- Flag as reduced
          UPDATE orders 
          SET metadata = metadata || '{"stock_reduced": true}'::jsonb
          WHERE id = updated_order.id;
          
      END IF;
  ELSE
       -- Fallback search
      SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_order_paid TO anon;
GRANT EXECUTE ON FUNCTION mark_order_paid TO authenticated;
GRANT EXECUTE ON FUNCTION mark_order_paid TO service_role;
