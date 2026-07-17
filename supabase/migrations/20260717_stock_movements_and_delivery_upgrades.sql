-- ============================================================
-- 1. STOCK MOVEMENTS (inventory history log)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid,
  variant_name text,
  change integer NOT NULL,
  quantity_after integer,
  reason text NOT NULL DEFAULT 'manual_adjustment',
  reference text,
  user_id uuid,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id, created_at DESC);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff view stock movements" ON public.stock_movements;
CREATE POLICY "Staff view stock movements" ON public.stock_movements
  FOR SELECT USING (public.is_admin_or_staff());

-- ============================================================
-- 2. Logging helper (SECURITY DEFINER so trigger inserts bypass RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.log_stock_movement(
  p_product_id uuid,
  p_variant_id uuid,
  p_variant_name text,
  p_change integer,
  p_quantity_after integer,
  p_default_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_reason text;
  v_ref text;
  v_uid uuid;
  v_email text;
BEGIN
  IF p_change = 0 OR p_change IS NULL THEN RETURN; END IF;

  v_reason := NULLIF(current_setting('app.stock_reason', true), '');
  v_ref := NULLIF(current_setting('app.stock_ref', true), '');
  IF v_reason IS NULL THEN v_reason := p_default_reason; END IF;

  BEGIN
    v_uid := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_uid := NULL;
  END;

  IF v_uid IS NOT NULL THEN
    BEGIN
      SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
    EXCEPTION WHEN OTHERS THEN
      v_email := NULL;
    END;
  END IF;

  INSERT INTO public.stock_movements
    (product_id, variant_id, variant_name, change, quantity_after, reason, reference, user_id, user_email)
  VALUES
    (p_product_id, p_variant_id, p_variant_name, p_change, p_quantity_after, v_reason, v_ref, v_uid, v_email);
END;
$$;

-- ============================================================
-- 3. Variant-level trigger: log every quantity change
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_log_variant_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.quantity, 0) <> 0 THEN
      PERFORM public.log_stock_movement(NEW.product_id, NEW.id, NEW.name, COALESCE(NEW.quantity, 0), NEW.quantity, 'initial_stock');
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.quantity, 0) <> COALESCE(OLD.quantity, 0) THEN
      PERFORM public.log_stock_movement(NEW.product_id, NEW.id, NEW.name, COALESCE(NEW.quantity, 0) - COALESCE(OLD.quantity, 0), NEW.quantity, 'manual_adjustment');
    END IF;
    RETURN NEW;
  ELSE -- DELETE
    IF COALESCE(OLD.quantity, 0) <> 0 THEN
      PERFORM public.log_stock_movement(OLD.product_id, OLD.id, OLD.name, -COALESCE(OLD.quantity, 0), 0, 'variant_removed');
    END IF;
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_variant_stock ON public.product_variants;
CREATE TRIGGER trg_log_variant_stock
AFTER INSERT OR UPDATE OF quantity OR DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.trg_log_variant_stock();

-- ============================================================
-- 4. Product-level trigger: only for products WITHOUT variants
--    (variant products are covered by the variant trigger; the
--    denormalised products.quantity sync must not double-log)
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_log_product_stock()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF COALESCE(current_setting('app.suppress_product_stock_log', true), '') = '1' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  IF COALESCE(NEW.quantity, 0) <> COALESCE(OLD.quantity, 0) THEN
    PERFORM public.log_stock_movement(NEW.id, NULL, NULL, COALESCE(NEW.quantity, 0) - COALESCE(OLD.quantity, 0), NEW.quantity, 'manual_adjustment');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_product_stock ON public.products;
CREATE TRIGGER trg_log_product_stock
AFTER UPDATE OF quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.trg_log_product_stock();

-- ============================================================
-- 5. Suppress product-level logging while the variant→product
--    quantity sync runs (it is a derived write, not a movement)
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_product_quantity_from_variants()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  IF v_product_id IS NOT NULL THEN
    PERFORM set_config('app.suppress_product_stock_log', '1', true);
    UPDATE products p
    SET quantity = COALESCE((
      SELECT SUM(quantity) FROM product_variants WHERE product_id = v_product_id
    ), 0)
    WHERE p.id = v_product_id;
    PERFORM set_config('app.suppress_product_stock_log', '0', true);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 6. Tag order-driven stock changes with a reason + order number
-- ============================================================

CREATE OR REPLACE FUNCTION public.decrement_order_stock(order_ref uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  ord_meta JSONB;
  ord_number text;
BEGIN
  SELECT metadata, order_number INTO ord_meta, ord_number FROM orders WHERE id = order_ref;
  IF ord_meta IS NULL THEN
    RETURN FALSE;
  END IF;

  IF (ord_meta->>'stock_reduced') = 'true' THEN
    RETURN TRUE;
  END IF;

  PERFORM set_config('app.stock_reason', 'sale', true);
  PERFORM set_config('app.stock_ref', COALESCE(ord_number, order_ref::text), true);

  UPDATE product_variants pv
  SET quantity = GREATEST(0, COALESCE(pv.quantity, 0) - oi.quantity)
  FROM order_items oi
  WHERE oi.order_id = order_ref
    AND COALESCE(
          oi.variant_id,
          CASE
            WHEN oi.metadata->>'variant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              THEN (oi.metadata->>'variant_id')::uuid
            ELSE NULL
          END
        ) = pv.id;

  UPDATE products p
  SET quantity = GREATEST(0, COALESCE(p.quantity, 0) - oi.quantity)
  FROM order_items oi
  WHERE oi.order_id = order_ref
    AND oi.variant_id IS NULL
    AND (oi.metadata->>'variant_id' IS NULL OR oi.metadata->>'variant_id' = '')
    AND oi.product_id = p.id;

  PERFORM set_config('app.stock_reason', '', true);
  PERFORM set_config('app.stock_ref', '', true);

  UPDATE orders
  SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"stock_reduced": true}'::jsonb
  WHERE id = order_ref;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.restock_cancelled_order()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'cancelled'
     AND OLD.status IS DISTINCT FROM 'cancelled'
     AND COALESCE(NEW.metadata->>'stock_reduced', '') = 'true' THEN

    PERFORM set_config('app.stock_reason', 'order_cancelled', true);
    PERFORM set_config('app.stock_ref', COALESCE(NEW.order_number, NEW.id::text), true);

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

    PERFORM set_config('app.stock_reason', '', true);
    PERFORM set_config('app.stock_ref', '', true);

    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
                    || jsonb_build_object(
                         'stock_reduced', false,
                         'stock_restored_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                       );
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 6b. Per-item cancel/return: tag the restock movements too.
--     Wraps the existing function body — only the GUC lines are new.
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_order_item(p_item_id uuid, p_action text, p_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    PERFORM set_config('app.stock_reason', 'item_' || p_action, true);
    PERFORM set_config('app.stock_ref', COALESCE(v_order.order_number, v_order.id::text), true);
    IF v_variant_id IS NOT NULL THEN
      UPDATE product_variants SET quantity = COALESCE(quantity, 0) + v_item.quantity WHERE id = v_variant_id;
    ELSE
      UPDATE products SET quantity = COALESCE(quantity, 0) + v_item.quantity WHERE id = v_item.product_id;
    END IF;
    PERFORM set_config('app.stock_reason', '', true);
    PERFORM set_config('app.stock_ref', '', true);
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

-- ============================================================
-- 7. delivery_zones upgrades: waive / discount / per-zone methods
-- ============================================================

ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS free_delivery boolean NOT NULL DEFAULT false;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.delivery_zones ADD COLUMN IF NOT EXISTS methods jsonb NOT NULL DEFAULT '[]'::jsonb;
