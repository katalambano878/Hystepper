-- ---------------------------------------------------------------------------
-- Stock decrement bug: rescue + harden
-- ---------------------------------------------------------------------------
-- Problem:
--   Customer checkout was inserting variant_id into order_items.metadata
--   instead of the order_items.variant_id column. The decrement_order_stock
--   RPC keyed off the column, found NULL on every customer order, and
--   fell through to decrementing products.quantity (which the storefront
--   doesn't use for variant-bearing products). Net effect: variant stock
--   never went down after a paid web order.
--
-- This migration:
--   1. Backfills order_items.variant_id from metadata->>'variant_id' for
--      every legacy row that still has the column NULL but metadata-set.
--   2. Hardens decrement_order_stock so it also falls back to the metadata
--      key — defends against any future code path that writes only metadata.
--   3. Leaves stock_reduced flags untouched. Re-running decrement_order_stock
--      on already-flagged orders is a no-op by design.
-- ---------------------------------------------------------------------------

-- Only backfill rows where the referenced variant still exists; if a
-- historical metadata variant_id points at a now-deleted product_variants
-- row, the FK would reject the UPDATE. Those rows fall through to the
-- function's metadata-based path at runtime instead.
UPDATE public.order_items oi
SET variant_id = (oi.metadata->>'variant_id')::uuid
WHERE oi.variant_id IS NULL
  AND oi.metadata ? 'variant_id'
  AND oi.metadata->>'variant_id' IS NOT NULL
  AND oi.metadata->>'variant_id' <> ''
  AND oi.metadata->>'variant_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1 FROM public.product_variants pv
    WHERE pv.id = (oi.metadata->>'variant_id')::uuid
  );

-- Harden the RPC. Behaviour change: when variant_id column is NULL we now
-- also try metadata->>'variant_id' before falling back to the parent-product
-- path. Idempotency flag still wins so this stays safe to re-run.

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

  IF (ord_meta->>'stock_reduced') = 'true' THEN
    RETURN TRUE;
  END IF;

  -- Variant items: decrement product_variants.quantity. Use the variant_id
  -- column when present, otherwise fall back to metadata->>'variant_id' so
  -- historical orders written before the checkout fix still work if their
  -- backfill missed (e.g. malformed UUID in metadata).
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

  -- Non-variant items: decrement parent products.quantity directly.
  UPDATE products p
  SET quantity = GREATEST(0, COALESCE(p.quantity, 0) - oi.quantity)
  FROM order_items oi
  WHERE oi.order_id = order_ref
    AND oi.variant_id IS NULL
    AND (oi.metadata->>'variant_id' IS NULL OR oi.metadata->>'variant_id' = '')
    AND oi.product_id = p.id;

  UPDATE orders
  SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"stock_reduced": true}'::jsonb
  WHERE id = order_ref;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION decrement_order_stock TO anon;
GRANT EXECUTE ON FUNCTION decrement_order_stock TO authenticated;
GRANT EXECUTE ON FUNCTION decrement_order_stock TO service_role;
