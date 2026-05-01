-- Replace the legacy `social_twitter` setting with `social_tiktok` for the
-- footer/admin social-link UI. Existing `social_twitter` rows are removed
-- since the field is no longer surfaced anywhere in the app.

INSERT INTO store_settings (key, value, description)
VALUES
  ('social_tiktok', '"https://www.tiktok.com/@hystepper"', 'TikTok profile URL')
ON CONFLICT (key) DO NOTHING;

DELETE FROM store_settings WHERE key = 'social_twitter';
