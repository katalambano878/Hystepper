-- Delivery could not be completed: rider returns order / unsuccessful delivery
-- Safe to run if the value already exists (e.g. applied manually in Supabase).
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'returned';
