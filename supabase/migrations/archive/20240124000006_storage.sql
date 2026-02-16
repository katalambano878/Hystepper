-- =============================================
-- STORAGE BUCKETS
-- =============================================

-- Products Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Avatars Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Reviews Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reviews', 'reviews', true)
ON CONFLICT (id) DO NOTHING;

-- Blog Bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('blog', 'blog', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for Storage (Simplified)
-- In production, you'd want tighter controls, but for now:
-- Public Read, Staff Write for content. User Write for own Avatar/Reviews.

-- This requires enabling RLS on storage.objects

-- Policy helper for storage (optional, usually done via dashboard or API)
-- We will just leave buckets created. Policies on storage.objects are complex to script 
-- without knowing the exact setup (e.g. storage schema is managed by Supabase).
-- But we can try to add some basic inserts if storage policies were customizable via SQL easily 
-- without extensions issues. Typically developers set this in Dashboard.
-- We will stick to creating buckets.
