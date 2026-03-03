-- Add rider role to staff table CHECK constraint
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'manager', 'staff', 'rider'));
