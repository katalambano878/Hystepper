-- CMS Content Tables for StandardStore
-- This migration creates tables to store customizable content for the frontend

-- Site Settings (global settings like logo, contact info, social links)
CREATE TABLE IF NOT EXISTS public.site_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL DEFAULT '{}',
    category TEXT NOT NULL DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CMS Content Blocks (reusable content sections)
CREATE TABLE IF NOT EXISTS public.cms_content (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    section TEXT NOT NULL, -- e.g., 'homepage', 'about', 'contact'
    block_key TEXT NOT NULL, -- e.g., 'hero', 'featured_products', 'testimonials'
    title TEXT,
    subtitle TEXT,
    content TEXT,
    image_url TEXT,
    button_text TEXT,
    button_url TEXT,
    metadata JSONB DEFAULT '{}',
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(section, block_key)
);

-- Banners (promotional banners, announcement bars)
CREATE TABLE IF NOT EXISTS public.banners (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'promotional', -- 'promotional', 'announcement', 'popup'
    title TEXT,
    subtitle TEXT,
    image_url TEXT,
    background_color TEXT DEFAULT '#000000',
    text_color TEXT DEFAULT '#FFFFFF',
    button_text TEXT,
    button_url TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    position TEXT DEFAULT 'top', -- 'top', 'bottom', 'popup'
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Navigation Menus
CREATE TABLE IF NOT EXISTS public.navigation_menus (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL, -- 'header', 'footer', 'mobile'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.navigation_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    menu_id UUID REFERENCES public.navigation_menus(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.navigation_items(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    is_external BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default site settings
INSERT INTO public.site_settings (key, value, category) VALUES
('site_name', '"StandardStore"', 'general'),
('site_tagline', '"Premium Shopping Experience"', 'general'),
('site_logo', '"/logo.png"', 'general'),
('contact_email', '"support@standardstore.com"', 'contact'),
('contact_phone', '"+233 XX XXX XXXX"', 'contact'),
('contact_address', '"Accra, Ghana"', 'contact'),
('social_facebook', '"https://facebook.com/standardstore"', 'social'),
('social_instagram', '"https://instagram.com/standardstore"', 'social'),
('social_twitter', '"https://twitter.com/standardstore"', 'social'),
('primary_color', '"#059669"', 'theme'),
('secondary_color', '"#0D9488"', 'theme'),
('currency', '"GHS"', 'general'),
('currency_symbol', '"GH₵"', 'general')
ON CONFLICT (key) DO NOTHING;

-- Insert default CMS content
INSERT INTO public.cms_content (section, block_key, title, subtitle, content, button_text, button_url, metadata) VALUES
('homepage', 'hero', 'Welcome to StandardStore', 'Discover premium products with fast delivery across Ghana', 'Shop the latest trends in fashion, electronics, and home essentials.', 'Shop Now', '/shop', '{"background_image": "/hero-bg.jpg"}'),
('homepage', 'featured_heading', 'Featured Products', 'Handpicked for you', 'Our most popular items this season', NULL, NULL, '{}'),
('homepage', 'categories_heading', 'Shop by Category', 'Browse our collections', 'Find exactly what you are looking for', NULL, NULL, '{}'),
('homepage', 'newsletter', 'Stay Updated', 'Subscribe to our newsletter', 'Get exclusive deals and updates delivered to your inbox', 'Subscribe', '#', '{}'),
('about', 'hero', 'About Us', 'Our Story', 'StandardStore was founded with a mission to bring premium quality products to customers across Ghana.', NULL, NULL, '{}'),
('about', 'mission', 'Our Mission', NULL, 'To provide the best shopping experience with quality products, fast delivery, and excellent customer service.', NULL, NULL, '{}'),
('contact', 'hero', 'Contact Us', 'Get in touch', 'We would love to hear from you. Send us a message and we will respond as soon as possible.', NULL, NULL, '{}')
ON CONFLICT (section, block_key) DO NOTHING;

-- Insert default navigation menus
INSERT INTO public.navigation_menus (id, name) VALUES
('11111111-1111-1111-1111-111111111111', 'header'),
('22222222-2222-2222-2222-222222222222', 'footer'),
('33333333-3333-3333-3333-333333333333', 'mobile')
ON CONFLICT DO NOTHING;

-- Insert default header navigation
INSERT INTO public.navigation_items (menu_id, label, url, sort_order) VALUES
('11111111-1111-1111-1111-111111111111', 'Shop', '/shop', 1),
('11111111-1111-1111-1111-111111111111', 'Categories', '/categories', 2),
('11111111-1111-1111-1111-111111111111', 'About', '/about', 3),
('11111111-1111-1111-1111-111111111111', 'Contact', '/contact', 4)
ON CONFLICT DO NOTHING;

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.navigation_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read, admin write
CREATE POLICY "Allow public read on site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Allow admin write on site_settings" ON public.site_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Allow public read on cms_content" ON public.cms_content FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on cms_content" ON public.cms_content FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Allow public read on banners" ON public.banners FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on banners" ON public.banners FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Allow public read on navigation_menus" ON public.navigation_menus FOR SELECT USING (true);
CREATE POLICY "Allow admin all on navigation_menus" ON public.navigation_menus FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE POLICY "Allow public read on navigation_items" ON public.navigation_items FOR SELECT USING (is_active = true);
CREATE POLICY "Allow admin all on navigation_items" ON public.navigation_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_cms_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_settings_timestamp BEFORE UPDATE ON public.site_settings
FOR EACH ROW EXECUTE FUNCTION update_cms_timestamp();

CREATE TRIGGER update_cms_content_timestamp BEFORE UPDATE ON public.cms_content
FOR EACH ROW EXECUTE FUNCTION update_cms_timestamp();

CREATE TRIGGER update_banners_timestamp BEFORE UPDATE ON public.banners
FOR EACH ROW EXECUTE FUNCTION update_cms_timestamp();
