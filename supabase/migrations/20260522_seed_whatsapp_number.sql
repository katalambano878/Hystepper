-- Make sure a row exists for whatsapp_number in store_settings so the
-- admin Contact & Social form has something to save into, and so the
-- floating WhatsApp button + checkout fallback can pick it up.
--
-- Uses the brand's current default number; merchants can change it
-- from /admin/settings → Contact & Social at any time. ON CONFLICT
-- DO NOTHING keeps any value already configured on the live site.

INSERT INTO store_settings (key, value, description)
VALUES
  ('whatsapp_number', '"233276558163"', 'WhatsApp number used by the floating chat button and contact fallbacks (digits only, no +)')
ON CONFLICT (key) DO NOTHING;
