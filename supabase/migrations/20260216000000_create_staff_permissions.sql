-- Staff members table for role-based access control
CREATE TABLE IF NOT EXISTS staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'manager', 'staff')),
  permissions JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "orders": false,
    "pos": false,
    "products": false,
    "categories": false,
    "customers": false,
    "reviews": false,
    "inventory": false,
    "analytics": false,
    "coupons": false,
    "notifications": false,
    "blog": false,
    "modules": false,
    "settings": false,
    "staff": false
  }',
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS staff_updated_at ON staff;
CREATE TRIGGER staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_staff_updated_at();

-- RLS policies
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage staff" ON staff;
CREATE POLICY "Admins can manage staff" ON staff
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Staff can view own record" ON staff;
CREATE POLICY "Staff can view own record" ON staff
  FOR SELECT USING (user_id = auth.uid());
