
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT,
    status TEXT DEFAULT 'draft',
    seo_title TEXT,
    seo_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_pages_updated_at ON pages;
CREATE TRIGGER update_pages_updated_at BEFORE UPDATE ON pages FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Seed data
INSERT INTO pages (title, slug, content, status, seo_description) VALUES 
('About Us', 'about-us', '<h2>About Us</h2><p>Welcome to our premium e-commerce store. We are dedicated to providing the best quality products.</p>', 'published', 'Learn more about our story and values'),
('Contact Us', 'contact-us', '<h2>Contact Us</h2><p>Reach out to us at <strong>support@standardecom.com</strong> or call us at +233 123 456 789.</p>', 'published', 'Get in touch with our support team'),
('Terms & Conditions', 'terms', '<h2>Terms & Conditions</h2><p>Please read these terms carefully before using our service.</p>', 'published', 'Our terms of service'),
('Privacy Policy', 'privacy', '<h2>Privacy Policy</h2><p>We value your privacy and are committed to protecting your personal data.</p>', 'published', 'Read our privacy policy'),
('Shipping Information', 'shipping', '<h2>Shipping Information</h2><p>We ship worldwide. Standard shipping takes 3-5 business days.</p>', 'published', 'Delivery times and shipping costs'),
('Returns & Refunds', 'returns', '<h2>Returns & Refunds</h2><p>You can return items within 30 days of receipt.</p>', 'published', 'Our return policy')
ON CONFLICT (slug) DO NOTHING;
