-- Keep products.quantity in sync with the SUM of its variant quantities.
--
-- Root cause of "stock shows higher than actual": decrement_order_stock (and the
-- restock/cancel paths) only adjust product_variants.quantity for variant
-- products. The denormalized products.quantity was never decremented, so the
-- number shown on product cards/detail drifted upward over time
-- (e.g. Flacco showed 22 with only 1 truly in stock).
--
-- This trigger makes products.quantity authoritative for every variant product,
-- regardless of which path changes a variant (orders, cancellations, per-item
-- returns, editor saves, POS). Non-variant products are untouched (no variant
-- rows -> trigger never fires for them).

CREATE OR REPLACE FUNCTION public.sync_product_quantity_from_variants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  IF v_product_id IS NOT NULL THEN
    UPDATE products p
    SET quantity = COALESCE((
      SELECT SUM(quantity) FROM product_variants WHERE product_id = v_product_id
    ), 0)
    WHERE p.id = v_product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_product_quantity ON public.product_variants;
CREATE TRIGGER trg_sync_product_quantity
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.sync_product_quantity_from_variants();

-- One-time backfill: correct all existing drift so displayed stock matches real
-- variant totals immediately.
UPDATE products p
SET quantity = COALESCE(s.total, 0)
FROM (
  SELECT product_id, SUM(quantity) AS total
  FROM product_variants
  GROUP BY product_id
) s
WHERE p.id = s.product_id
  AND p.quantity IS DISTINCT FROM COALESCE(s.total, 0);
