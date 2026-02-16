-- Migration: Loyalty points trigger
-- Awards 5 points PER ITEM when an order is delivered
-- Points expire after 6 months

CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  total_items INTEGER;
  points_to_award INTEGER;
  user_points_exists BOOLEAN;
BEGIN
  -- Only fire when status changes to 'delivered'
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Count total items in the order
    SELECT COALESCE(SUM(quantity), 0) INTO total_items
    FROM order_items WHERE order_id = NEW.id;
    
    -- 5 points per item purchased
    points_to_award := total_items * 5;
    
    IF points_to_award > 0 AND NEW.user_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM loyalty_points WHERE user_id = NEW.user_id) INTO user_points_exists;
      
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
      
      -- Log transaction
      INSERT INTO loyalty_transactions (user_id, order_id, amount, type, description)
      VALUES (
        NEW.user_id, 
        NEW.id, 
        points_to_award, 
        'earn', 
        'Earned ' || points_to_award || ' points (' || total_items || ' items x 5 pts) from Order #' || NEW.order_number
      );
      
      -- Store points earned on the order record
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
