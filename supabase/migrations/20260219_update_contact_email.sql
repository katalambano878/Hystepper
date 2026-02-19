-- Update the contact_email setting in the store_settings table
UPDATE store_settings
SET value = 'hystepper2@gmail.com'
WHERE key = 'contact_email';

-- Insert if it doesn't exist (upsert logic for key)
INSERT INTO store_settings (key, value, type, description)
SELECT 'contact_email', 'hystepper2@gmail.com', 'string', 'Main contact email address'
WHERE NOT EXISTS (SELECT 1 FROM store_settings WHERE key = 'contact_email');
