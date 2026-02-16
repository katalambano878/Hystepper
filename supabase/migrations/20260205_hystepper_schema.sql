-- Migration for Hy_stepper Features
-- Run this on the correct Supabase project

-- ============================================================
-- 1. PRODUCTS TABLE - Add footwear-specific fields + product_code
-- ============================================================
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_code TEXT,
ADD COLUMN IF NOT EXISTS style_name TEXT,
ADD COLUMN IF NOT EXISTS heel_height TEXT,
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS sizing_notes TEXT,
ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'available';

-- ============================================================
-- 2. ORDERS TABLE - Add delivery notes, payment options, points
-- ============================================================
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS payment_option TEXT DEFAULT 'full_payment',
ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10,2) DEFAULT 0;

-- ============================================================
-- 3. DELIVERY ZONES TABLE
--    Includes per_item_fee for outside-Accra calculation
--    and transport_service for bus/transport info
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    is_accra BOOLEAN DEFAULT false,
    base_fee DECIMAL(10,2) DEFAULT 0,
    per_item_fee DECIMAL(10,2) DEFAULT 0,
    transport_service TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Public view delivery zones" ON delivery_zones FOR SELECT USING (is_active = true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Staff manage delivery zones" ON delivery_zones FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. LOYALTY POINTS TABLE
--    expires_at for 6-month point expiry
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    points INTEGER DEFAULT 0,
    lifetime_earned INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own points" ON loyalty_points FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin manage points" ON loyalty_points FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. LOYALTY TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own transactions" ON loyalty_transactions FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admin manage transactions" ON loyalty_transactions FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. STORE SETTINGS - delivery toggles
-- ============================================================
INSERT INTO store_settings (key, value, description)
VALUES 
    ('next_day_delivery_enabled', 'false', 'When ON, restricts all delivery to next-day only (no standard option)'),
    ('delivery_unavailable', 'false', 'When ON, blocks checkout — delivery is not available today')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 7. SEED DELIVERY ZONES
--    Outside Accra: base_fee + (per_item_fee x number_of_items)
--    Inside Accra: base_fee only (flat rate)
-- ============================================================
INSERT INTO delivery_zones (name, is_accra, base_fee, per_item_fee, transport_service) VALUES
('Accra (Standard)', true, 25.00, 0, NULL),
('Kumasi', false, 45.00, 10.00, 'VIP / STC'),
('Sunyani', false, 50.00, 10.00, 'VIP / STC'),
('Cape Coast', false, 40.00, 10.00, 'VIP / STC'),
('Takoradi', false, 40.00, 10.00, 'VIP / STC')
ON CONFLICT DO NOTHING;
