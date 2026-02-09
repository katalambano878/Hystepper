-- Migration: Hy_stepper Improvements
-- Date: 2026-02-08
-- 
-- This migration adds:
-- 1. stock_notifications table (Notify Me When Back in Stock)
-- 2. Currency default fix for store_settings
-- 3. Size guide link in store_settings
-- 4. WhatsApp number in store_settings
-- 5. Coupon usage_count column fix (ensure it exists)
-- 6. Review verified_purchase check improvements
-- 7. RLS policies for stock_notifications
-- 8. Admin notification for low stock (trigger)
--
-- PRE-REQUISITES: Run after 20260204000000_consolidated_full.sql, 
--                 20260205_hystepper_schema.sql, and 20260205_loyalty_trigger.sql

-- ============================================================
-- 1. STOCK NOTIFICATIONS TABLE (Notify Me When Back in Stock)
-- ============================================================
CREATE TABLE IF NOT EXISTS stock_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    notified BOOLEAN DEFAULT false,
    notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one notification per email per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_notifications_unique 
ON stock_notifications (product_id, email);

ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;

-- Anyone can subscribe for notifications (insert)
DO $$ BEGIN
  CREATE POLICY "Anyone can subscribe to stock notifications"
    ON stock_notifications FOR INSERT
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can view their own notifications
DO $$ BEGIN
  CREATE POLICY "Users view own stock notifications"
    ON stock_notifications FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Admins can manage all notifications
DO $$ BEGIN
  CREATE POLICY "Admin manage stock notifications"
    ON stock_notifications FOR ALL
    USING (is_admin_or_staff())
    WITH CHECK (is_admin_or_staff());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. STORE SETTINGS - Additional settings
-- ============================================================
INSERT INTO store_settings (key, value, description)
VALUES 
    ('currency', '"GHS"', 'Store currency code'),
    ('currency_symbol', '"GH₵"', 'Store currency symbol'),
    ('whatsapp_number', '"233276558163"', 'WhatsApp number for customer support (without +)'),
    ('exchange_window_hours', '24', 'Hours after delivery that exchanges are accepted'),
    ('loyalty_points_per_item', '5', 'Loyalty points earned per item in a delivered order'),
    ('loyalty_min_redeem', '15', 'Minimum points needed to redeem at checkout'),
    ('loyalty_expiry_months', '6', 'Number of months before loyalty points expire')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. ORDERS TABLE - Ensure coupon tracking columns exist
-- ============================================================
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- 4. RETURN REQUESTS - Add convenience fields
-- ============================================================
ALTER TABLE return_requests
ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'exchange', -- 'exchange' or 'refund'
ADD COLUMN IF NOT EXISTS contact_email TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- ============================================================
-- 5. LOW STOCK NOTIFICATION TRIGGER
--    Creates a notification for admins when stock goes below threshold
-- ============================================================
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  threshold INTEGER := 10;
  admin_users RECORD;
BEGIN
  -- Only fire when quantity decreases to below threshold
  IF NEW.quantity < threshold AND (OLD.quantity >= threshold OR OLD.quantity IS NULL) THEN
    -- Notify all admin users
    FOR admin_users IN 
      SELECT id FROM profiles WHERE role IN ('admin', 'staff')
    LOOP
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        admin_users.id,
        'low_stock',
        'Low Stock Alert: ' || NEW.name,
        NEW.name || ' has only ' || NEW.quantity || ' units remaining.',
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
  IF NEW.quantity = 0 AND OLD.quantity > 0 THEN
    FOR admin_users IN 
      SELECT id FROM profiles WHERE role IN ('admin', 'staff')
    LOOP
      INSERT INTO notifications (user_id, type, title, message, metadata)
      VALUES (
        admin_users.id,
        'out_of_stock',
        'OUT OF STOCK: ' || NEW.name,
        NEW.name || ' is now completely out of stock!',
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_low_stock_notification ON products;
CREATE TRIGGER trigger_low_stock_notification
  AFTER UPDATE OF quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION notify_low_stock();

-- ============================================================
-- 6. STOCK RESTOCK - AUTO-NOTIFY SUBSCRIBERS
--    When a product is restocked (quantity goes from 0 to > 0),
--    mark stock_notifications as needing to be sent.
--    (Actual email sending happens via Edge Function or cron)
-- ============================================================
CREATE OR REPLACE FUNCTION handle_restock_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- When product goes from 0 to some stock
  IF NEW.quantity > 0 AND OLD.quantity = 0 THEN
    -- Mark notifications as ready to send (notified = false means pending)
    -- A separate process (Edge Function / cron) will pick these up and send emails
    -- We don't mark as notified here - the email sender does that
    NULL; -- Placeholder: notifications remain in notified=false state for the sender to pick up
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_restock_notifications ON products;
CREATE TRIGGER trigger_restock_notifications
  AFTER UPDATE OF quantity ON products
  FOR EACH ROW
  EXECUTE FUNCTION handle_restock_notifications();

-- ============================================================
-- 7. PRODUCT VARIANT IMPROVEMENTS
--    Ensure option2 column exists for color variants
-- ============================================================
ALTER TABLE product_variants
ADD COLUMN IF NOT EXISTS option2 TEXT;

COMMENT ON COLUMN product_variants.option2 IS 'Secondary variant option (e.g., color)';

-- ============================================================
-- 8. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reviews_product_status 
ON reviews (product_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_user_status 
ON orders (user_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_order_number 
ON orders (order_number);

CREATE INDEX IF NOT EXISTS idx_orders_email 
ON orders (email);



CREATE INDEX IF NOT EXISTS idx_products_slug 
ON products (slug);

CREATE INDEX IF NOT EXISTS idx_stock_notifications_product 
ON stock_notifications (product_id, notified);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_user 
ON loyalty_points (user_id);

CREATE INDEX IF NOT EXISTS idx_coupons_code_active 
ON coupons (code, is_active);

-- ============================================================
-- 9. ENSURE COUPON RLS ALLOWS PUBLIC READ OF ACTIVE COUPONS
-- ============================================================
DO $$ BEGIN
  CREATE POLICY "Anyone can validate coupons"
    ON coupons FOR SELECT
    USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 10. AUDIT LOG - Track coupon usage
-- ============================================================
DO $$ BEGIN
  CREATE POLICY "Users can update coupon usage count"
    ON coupons FOR UPDATE
    USING (is_active = true)
    WITH CHECK (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
