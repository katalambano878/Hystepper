-- Fix RLS policies for storage buckets (products and media)
-- This ensures admins can upload images to both buckets

-- Enable RLS on objects if not already (standard supabase setup)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- PRODUCTS BUCKET POLICIES
DROP POLICY IF EXISTS "Admin upload access for products" ON storage.objects;
DROP POLICY IF EXISTS "Admin update access for products" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access for products" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for products" ON storage.objects;

CREATE POLICY "Public read access for products" ON storage.objects FOR SELECT
USING (bucket_id = 'products');

CREATE POLICY "Admin upload access for products" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'products' AND (public.is_admin_or_staff() = true));

CREATE POLICY "Admin update access for products" ON storage.objects FOR UPDATE
USING (bucket_id = 'products' AND (public.is_admin_or_staff() = true));

CREATE POLICY "Admin delete access for products" ON storage.objects FOR DELETE
USING (bucket_id = 'products' AND (public.is_admin_or_staff() = true));


-- MEDIA BUCKET POLICIES (for CMS)
DROP POLICY IF EXISTS "Admin upload access for media" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete access for media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for media" ON storage.objects;

CREATE POLICY "Public read access for media" ON storage.objects FOR SELECT
USING (bucket_id = 'media');

CREATE POLICY "Admin upload access for media" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'media' AND (public.is_admin_or_staff() = true));

CREATE POLICY "Admin delete access for media" ON storage.objects FOR DELETE
USING (bucket_id = 'media' AND (public.is_admin_or_staff() = true));
