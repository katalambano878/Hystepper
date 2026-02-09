-- Fixing notify_low_stock trigger function to use 'data' column instead of non-existent 'metadata' column in notifications table

CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  threshold INTEGER := 10;
  admin_user RECORD;
BEGIN
  -- Only fire when quantity decreases to below threshold
  IF (NEW.quantity < threshold) AND (OLD.quantity >= threshold OR OLD.quantity IS NULL) THEN
    -- Notify all admin users
    FOR admin_user IN 
      SELECT id FROM profiles WHERE role IN ('admin', 'staff')
    LOOP
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        admin_user.id,
        'low_stock',
        'Low Stock Alert: ' || NEW.name,
        'Product ' || NEW.name || ' has only ' || NEW.quantity || ' units remaining.',
        jsonb_build_object(
          'product_id', NEW.id,
          'product_name', NEW.name,
          'current_stock', NEW.quantity,
          'sku', COALESCE(NEW.sku, 'N/A')
        )
      );
    END LOOP;
  END IF;
  
  -- If stock goes to 0, also create out-of-stock notification
  IF NEW.quantity = 0 AND (OLD.quantity > 0 OR OLD.quantity IS NULL) THEN
    FOR admin_user IN 
      SELECT id FROM profiles WHERE role IN ('admin', 'staff')
    LOOP
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        admin_user.id,
        'out_of_stock',
        'OUT OF STOCK: ' || NEW.name,
        'Product ' || NEW.name || ' is now completely out of stock!',
        jsonb_build_object(
          'product_id', NEW.id,
          'product_name', NEW.name,
          'sku', COALESCE(NEW.sku, 'N/A')
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
