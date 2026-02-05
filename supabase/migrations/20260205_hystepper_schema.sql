-- Migration for Hy_stepper Rebranding & Features

-- 1. Update Products Table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS style_name TEXT,
ADD COLUMN IF NOT EXISTS heel_height TEXT, -- e.g. "3 inches"
ADD COLUMN IF NOT EXISTS material TEXT,
ADD COLUMN IF NOT EXISTS sizing_notes TEXT,
ADD COLUMN IF NOT EXISTS stock_status TEXT DEFAULT 'available'; -- available, low_stock, sold_out

-- 2. Update Orders Table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS delivery_notes TEXT,
ADD COLUMN IF NOT EXISTS payment_option TEXT DEFAULT 'full_payment', -- 'item_only', 'full_payment'
ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_redeemed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS points_discount DECIMAL(10,2) DEFAULT 0;

-- 3. Delivery Zones
CREATE TABLE IF NOT EXISTS delivery_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- "Accra", "Kumasi", "Sunyani", etc.
    is_accra BOOLEAN DEFAULT false,
    base_fee DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for delivery_zones
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view delivery zones" ON delivery_zones FOR SELECT USING (is_active = true);
CREATE POLICY "Staff manage delivery zones" ON delivery_zones USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- 4. Settings Update (Insert if not exists)
INSERT INTO store_settings (key, value, description)
VALUES 
    ('next_day_delivery_enabled', 'false', 'Toggle to restrict delivery to next day only'),
    ('delivery_unavailable', 'false', 'Toggle to stop all deliveries')
ON CONFLICT (key) DO NOTHING;

-- 5. Insert initial Delivery Zones
INSERT INTO delivery_zones (name, is_accra, base_fee) VALUES
('Accra (Standard)', true, 25.00),
('Kumasi', false, 45.00),
('Sunyani', false, 50.00),
('Cape Coast', false, 40.00),
('Takoradi', false, 40.00)
ON CONFLICT DO NOTHING;
