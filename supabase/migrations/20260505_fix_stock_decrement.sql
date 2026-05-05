-- ---------------------------------------------------------------------------
-- Fix stock decrement on order creation / payment
-- ---------------------------------------------------------------------------
-- Problem this migration solves
--   1. mark_order_paid only decremented products.quantity. For orders that
--      contained variant rows (size/colour SKUs) the variant stock was never
--      reduced, so /shop and the product page showed stale availability.
--   2. Cash-on-coupon / 100%-points orders skip mark_order_paid entirely
--      (the checkout flow short-circuits when payableNow<=0), so stock never
--      reduced for those orders.
--   3. Manually-created admin orders (/admin/orders/create) did not touch
--      stock at all.
--
-- We introduce a single idempotent RPC, decrement_order_stock(order_id),
-- and have mark_order_paid call it. The web checkout & manual admin order
-- paths call it directly when their flow doesn't pass through the payment
-- webhook.

CREATE OR REPLACE FUNCTION decrement_order_stock(order_ref UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord_meta JSONB;
BEGIN
  SELECT metadata INTO ord_meta FROM orders WHERE id = order_ref;
  IF ord_meta IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Idempotent: skip if already reduced (POS sets this up-front, payment
  -- webhook sets this after running, etc.)
  IF (ord_meta->>'stock_reduced') = 'true' THEN
    RETURN TRUE;
  END IF;

  -- Variant items: decrement product_variants.quantity. Shop/product pages
  -- compute total inventory by summing variant rows, so we don't need to
  -- also touch the parent products row here.
  UPDATE product_variants pv
  SET quantity = GREATEST(0, COALESCE(pv.quantity, 0) - oi.quantity)
  FROM order_items oi
  WHERE oi.order_id = order_ref
    AND oi.variant_id IS NOT NULL
    AND oi.variant_id = pv.id;

  -- Non-variant items: decrement parent products.quantity directly.
  UPDATE products p
  SET quantity = GREATEST(0, COALESCE(p.quantity, 0) - oi.quantity)
  FROM order_items oi
  WHERE oi.order_id = order_ref
    AND oi.variant_id IS NULL
    AND oi.product_id = p.id;

  -- Flag the order so we can never double-deduct.
  UPDATE orders
  SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"stock_reduced": true}'::jsonb
  WHERE id = order_ref;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_order_stock TO anon;
GRANT EXECUTE ON FUNCTION decrement_order_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_order_stock TO service_role;


-- Replace mark_order_paid to delegate stock reduction to the new helper so
-- variants are honoured, and both flows agree on the same idempotency flag.

CREATE OR REPLACE FUNCTION mark_order_paid(order_ref TEXT, moolre_ref TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_order orders;
BEGIN
  UPDATE orders
  SET
    payment_status = 'paid',
    status = CASE
        WHEN status = 'pending' THEN 'processing'::order_status
        WHEN status = 'awaiting_payment' THEN 'processing'::order_status
        ELSE status
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) ||
               jsonb_build_object(
                   'moolre_reference', moolre_ref,
                   'payment_verified_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
               )
  WHERE order_number = order_ref
  RETURNING * INTO updated_order;

  IF updated_order IS NOT NULL THEN
    PERFORM decrement_order_stock(updated_order.id);
  ELSE
    SELECT * INTO updated_order FROM orders WHERE order_number = order_ref;
  END IF;

  RETURN to_jsonb(updated_order);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_order_paid TO anon;
GRANT EXECUTE ON FUNCTION mark_order_paid TO authenticated;
GRANT EXECUTE ON FUNCTION mark_order_paid TO service_role;
