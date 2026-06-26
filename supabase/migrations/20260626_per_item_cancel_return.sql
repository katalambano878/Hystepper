-- Item-level cancel/return support.

-- 1) Line-item status columns.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- 2) Guard the existing full-order restock trigger so it never double-restocks
--    items that were already individually cancelled/returned (restocked).
CREATE OR REPLACE FUNCTION public.restock_cancelled_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND COALESCE(NEW.metadata->>'stock_reduced', '') = 'true' THEN

    -- Restore variant stock (only lines still active — individually cancelled
    -- lines were already restocked).
    UPDATE product_variants pv
    SET quantity = COALESCE(pv.quantity, 0) + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND COALESCE(oi.status, 'active') = 'active'
      AND COALESCE(
            oi.variant_id,
            CASE
              WHEN oi.metadata->>'variant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (oi.metadata->>'variant_id')::uuid
              ELSE NULL
            END
          ) = pv.id;

    -- Restore product stock for non-variant items (only active lines).
    UPDATE products p
    SET quantity = COALESCE(p.quantity, 0) + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND COALESCE(oi.status, 'active') = 'active'
      AND oi.variant_id IS NULL
      AND (oi.metadata->>'variant_id' IS NULL OR oi.metadata->>'variant_id' = '')
      AND oi.product_id = p.id;

    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
                    || jsonb_build_object(
                         'stock_reduced', false,
                         'stock_restored_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                       );
  END IF;

  RETURN NEW;
END;
$function$;

-- 3) Per-item cancel/return: restock that one line, mark it, recompute order
--    money, record a partial refund, and (if it was the last active line)
--    close out the whole order. Secured to admin/staff only.
CREATE OR REPLACE FUNCTION public.cancel_order_item(
  p_item_id uuid,
  p_action text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_item order_items%ROWTYPE;
  v_order orders%ROWTYPE;
  v_variant_id uuid;
  v_stock_reduced boolean;
  v_new_subtotal numeric;
  v_new_total numeric;
  v_remaining_active int;
  v_remaining_returned int;
  v_remaining_cancelled int;
  v_new_status order_status;
  v_new_payment payment_status;
  v_meta jsonb;
  v_refund jsonb;
BEGIN
  IF NOT public.is_admin_or_staff() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_action NOT IN ('cancelled', 'returned') THEN
    RAISE EXCEPTION 'Invalid action: %', p_action;
  END IF;

  SELECT * INTO v_item FROM order_items WHERE id = p_item_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order item not found';
  END IF;

  IF v_item.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Item already ' || v_item.status);
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_item.order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_stock_reduced := COALESCE(v_order.metadata->>'stock_reduced', '') = 'true';

  v_variant_id := COALESCE(
    v_item.variant_id,
    CASE WHEN v_item.metadata->>'variant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN (v_item.metadata->>'variant_id')::uuid ELSE NULL END
  );

  -- Restock only if the order's stock had actually been deducted.
  IF v_stock_reduced THEN
    IF v_variant_id IS NOT NULL THEN
      UPDATE product_variants SET quantity = COALESCE(quantity, 0) + v_item.quantity WHERE id = v_variant_id;
    ELSE
      UPDATE products SET quantity = COALESCE(quantity, 0) + v_item.quantity WHERE id = v_item.product_id;
    END IF;
  END IF;

  UPDATE order_items
  SET status = p_action,
      cancel_reason = p_reason,
      cancelled_at = now(),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('restocked', v_stock_reduced)
  WHERE id = p_item_id;

  SELECT COALESCE(SUM(total_price), 0) INTO v_new_subtotal
  FROM order_items WHERE order_id = v_order.id AND status = 'active';

  v_new_total := GREATEST(0, v_new_subtotal
                 + COALESCE(v_order.shipping_total, 0)
                 + COALESCE(v_order.tax_total, 0)
                 - COALESCE(v_order.discount_total, 0));

  SELECT
    COUNT(*) FILTER (WHERE status = 'active'),
    COUNT(*) FILTER (WHERE status = 'returned'),
    COUNT(*) FILTER (WHERE status = 'cancelled')
  INTO v_remaining_active, v_remaining_returned, v_remaining_cancelled
  FROM order_items WHERE order_id = v_order.id;

  v_refund := jsonb_build_object(
    'item_id', v_item.id,
    'product_name', v_item.product_name,
    'variant_name', v_item.variant_name,
    'quantity', v_item.quantity,
    'amount', v_item.total_price,
    'type', p_action,
    'reason', p_reason,
    'restocked', v_stock_reduced,
    'at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  );

  v_meta := COALESCE(v_order.metadata, '{}'::jsonb)
            || jsonb_build_object(
                 'item_refunds', COALESCE(v_order.metadata->'item_refunds', '[]'::jsonb) || jsonb_build_array(v_refund),
                 'partial_refund_total', COALESCE((v_order.metadata->>'partial_refund_total')::numeric, 0) + v_item.total_price
               );

  v_new_status := v_order.status;
  v_new_payment := v_order.payment_status;

  IF v_remaining_active = 0 THEN
    IF v_remaining_cancelled = 0 AND v_remaining_returned > 0 THEN
      v_new_status := 'returned';
    ELSE
      v_new_status := 'cancelled';
    END IF;
    IF v_order.payment_status = 'paid' THEN
      v_new_payment := 'refunded';
    END IF;
    -- Stock already returned line-by-line; stop the order trigger re-restocking.
    v_meta := v_meta || jsonb_build_object('stock_reduced', false);
  END IF;

  UPDATE orders
  SET subtotal = v_new_subtotal,
      total = v_new_total,
      status = v_new_status,
      payment_status = v_new_payment,
      metadata = v_meta,
      updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'ok', true,
    'restocked', v_stock_reduced,
    'new_subtotal', v_new_subtotal,
    'new_total', v_new_total,
    'order_status', v_new_status,
    'order_closed', v_remaining_active = 0,
    'remaining_active', v_remaining_active
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.cancel_order_item(uuid, text, text) TO authenticated;
