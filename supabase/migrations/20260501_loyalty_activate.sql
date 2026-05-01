-- =====================================================================
-- Loyalty programme: install trigger + backfill past delivered orders.
--
-- Rules (confirmed with merchant):
--   • Earn 5 points per item purchased.
--   • Points are credited the moment an order's status flips to
--     'delivered' (so customers don't earn on cancelled / returned ones).
--   • Customers can start redeeming once they hit 15 points (≥ 3 items).
--   • Points expire 6 months after the most recent earn event.
--
-- This file is idempotent: safe to re-run.
-- =====================================================================

CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  points_to_award INTEGER;
  user_points_exists BOOLEAN;
BEGIN
  -- Only fire when status changes into 'delivered' for the first time.
  IF NEW.status = 'delivered' AND COALESCE(OLD.status, '') <> 'delivered' THEN
    -- Count total items in the order.
    SELECT COALESCE(SUM(quantity), 0) INTO total_items
    FROM order_items WHERE order_id = NEW.id;

    points_to_award := total_items * 5;

    IF points_to_award > 0 AND NEW.user_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM loyalty_points WHERE user_id = NEW.user_id)
      INTO user_points_exists;

      IF user_points_exists THEN
        UPDATE loyalty_points
        SET
          points = points + points_to_award,
          lifetime_earned = lifetime_earned + points_to_award,
          expires_at = NOW() + INTERVAL '6 months',
          updated_at = NOW()
        WHERE user_id = NEW.user_id;
      ELSE
        INSERT INTO loyalty_points (user_id, points, lifetime_earned, expires_at)
        VALUES (NEW.user_id, points_to_award, points_to_award, NOW() + INTERVAL '6 months');
      END IF;

      INSERT INTO loyalty_transactions (user_id, order_id, amount, type, description)
      VALUES (
        NEW.user_id,
        NEW.id,
        points_to_award,
        'earn',
        'Earned ' || points_to_award || ' points (' || total_items || ' items × 5 pts) from Order #' || NEW.order_number
      );

      UPDATE orders SET points_earned = points_to_award WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_award_loyalty_points ON orders;
CREATE TRIGGER trigger_award_loyalty_points
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points();

-- =====================================================================
-- One-time backfill: award points for past 'delivered' orders that were
-- placed before the trigger was installed (only for orders attached to
-- a real user — guest / POS orders are intentionally skipped).
-- =====================================================================
DO $$
DECLARE
  o RECORD;
  total_items INTEGER;
  points_to_award INTEGER;
  user_points_exists BOOLEAN;
BEGIN
  FOR o IN
    SELECT id, user_id, order_number
    FROM orders
    WHERE status = 'delivered'
      AND user_id IS NOT NULL
      AND COALESCE(points_earned, 0) = 0
  LOOP
    SELECT COALESCE(SUM(quantity), 0) INTO total_items
    FROM order_items WHERE order_id = o.id;

    points_to_award := total_items * 5;
    IF points_to_award <= 0 THEN
      CONTINUE;
    END IF;

    -- Skip if we've already logged an earn transaction for this order
    -- (defensive — keeps the DO block idempotent).
    IF EXISTS (
      SELECT 1 FROM loyalty_transactions
      WHERE order_id = o.id AND type = 'earn'
    ) THEN
      CONTINUE;
    END IF;

    SELECT EXISTS(SELECT 1 FROM loyalty_points WHERE user_id = o.user_id)
    INTO user_points_exists;

    IF user_points_exists THEN
      UPDATE loyalty_points
      SET
        points = points + points_to_award,
        lifetime_earned = lifetime_earned + points_to_award,
        expires_at = NOW() + INTERVAL '6 months',
        updated_at = NOW()
      WHERE user_id = o.user_id;
    ELSE
      INSERT INTO loyalty_points (user_id, points, lifetime_earned, expires_at)
      VALUES (o.user_id, points_to_award, points_to_award, NOW() + INTERVAL '6 months');
    END IF;

    INSERT INTO loyalty_transactions (user_id, order_id, amount, type, description)
    VALUES (
      o.user_id,
      o.id,
      points_to_award,
      'earn',
      'Backfilled ' || points_to_award || ' points (' || total_items || ' items × 5 pts) from Order #' || o.order_number
    );

    UPDATE orders SET points_earned = points_to_award WHERE id = o.id;
  END LOOP;
END $$;
