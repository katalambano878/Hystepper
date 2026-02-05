-- Migration: Add trigger to award loyalty points when order is completed

-- Function to calculate and award points
CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  points_to_award INTEGER;
  user_points_exists BOOLEAN;
BEGIN
  -- Only process if status changed to 'completed' (or 'delivered' depending on flow, usually 'completed' is final)
  -- The migration schema defined status enum: pending, awaiting_payment, processing, shipped, delivered, cancelled, refunded
  -- 'delivered' is likely the completion state for e-commerce, or maybe there is a 'completed' (Wait, enum didn't have 'completed')
  -- Enum: 'pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  -- I should probably use 'delivered'.
  
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    -- Calculate points: 1 point per 10 GHS of subtotal
    points_to_award := FLOOR(NEW.subtotal / 10);
    
    IF points_to_award > 0 AND NEW.user_id IS NOT NULL THEN
      -- Check if user exists in loyalty_points
      SELECT EXISTS(SELECT 1 FROM loyalty_points WHERE user_id = NEW.user_id) INTO user_points_exists;
      
      IF user_points_exists THEN
        UPDATE loyalty_points
        SET 
          points = points + points_to_award,
          lifetime_earned = lifetime_earned + points_to_award,
          updated_at = NOW()
        WHERE user_id = NEW.user_id;
      ELSE
        INSERT INTO loyalty_points (user_id, points, lifetime_earned)
        VALUES (NEW.user_id, points_to_award, points_to_award);
      END IF;
      
      -- Log transaction
      INSERT INTO loyalty_transactions (user_id, order_id, amount, type, description)
      VALUES (
        NEW.user_id, 
        NEW.id, 
        points_to_award, 
        'earn', 
        'Points earned from Order #' || NEW.order_number
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger definition
DROP TRIGGER IF EXISTS trigger_award_loyalty_points ON orders;
CREATE TRIGGER trigger_award_loyalty_points
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points();
