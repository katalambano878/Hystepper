-- Restore product stock automatically when an order is cancelled.
--
-- Previously, decrement_order_stock() reduced inventory when an order was paid
-- (guarded by metadata.stock_reduced), but nothing ever added that stock back
-- when the order was later cancelled — leaving stock permanently understated.
--
-- This BEFORE UPDATE trigger mirrors decrement_order_stock() in reverse. It
-- runs whenever an order transitions INTO 'cancelled' and only if its stock was
-- actually deducted (stock_reduced = true). It flips stock_reduced back to
-- false so a future re-confirmation can deduct again cleanly (idempotent).
--
-- Note: handled centrally at the DB layer so EVERY cancellation path (admin UI,
-- order detail page, bulk actions, API/webhooks, direct SQL) restocks correctly.

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

    -- Restore variant stock (items tied to a product_variants row).
    UPDATE product_variants pv
    SET quantity = COALESCE(pv.quantity, 0) + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND COALESCE(
            oi.variant_id,
            CASE
              WHEN oi.metadata->>'variant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (oi.metadata->>'variant_id')::uuid
              ELSE NULL
            END
          ) = pv.id;

    -- Restore product stock for non-variant items.
    UPDATE products p
    SET quantity = COALESCE(p.quantity, 0) + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
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

DROP TRIGGER IF EXISTS trg_restock_cancelled_order ON public.orders;
CREATE TRIGGER trg_restock_cancelled_order
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.restock_cancelled_order();
