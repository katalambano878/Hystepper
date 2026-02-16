INSERT INTO store_settings (key, value, description)
VALUES
  ('site_name', '"Hy_stepper"', 'The name of the website'),
  ('site_tagline', '"Steps Ahead in Style."', 'The tagline of the website'),
  ('site_logo', '"/logo.png"', 'Path to the site logo'),
  ('contact_email', '"info@hystepper.com"', 'Contact email address'),
  ('contact_phone', '"0276558163"', 'Contact phone number'),
  ('contact_address', '"Accra, Ghana"', 'Physical contact address'),
  ('social_facebook', '"https://facebook.com/hystepper"', 'Facebook profile URL'),
  ('social_instagram', '"https://instagram.com/hystepper"', 'Instagram profile URL'),
  ('social_twitter', '"https://twitter.com/hystepper"', 'Twitter/X profile URL'),
  ('primary_color', '"#FBF6F2"', 'Primary brand color'),
  ('secondary_color', '"#A14F57"', 'Secondary brand color')
ON CONFLICT (key) DO NOTHING;
