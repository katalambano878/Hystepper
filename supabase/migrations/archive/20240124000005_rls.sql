-- =============================================
-- RLS HELPER FUNCTIONS
-- =============================================
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role IN ('admin', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES
-- =============================================
-- Public read of basic profile info (avatar, name) needed for reviews/comments? 
-- Let's restrict to owner and staff for now, unless we want public profiles.
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Staff view any profile" ON profiles FOR SELECT USING (is_admin_or_staff());
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
-- Profile creation handled by triggers usually, or initial auth.

-- =============================================
-- ADDRESSES
-- =============================================
CREATE POLICY "Users manage own addresses" ON addresses 
  USING (auth.uid() = user_id) 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff manage all addresses" ON addresses 
  USING (is_admin_or_staff()) 
  WITH CHECK (is_admin_or_staff());

-- =============================================
-- PRODUCTS & CATALOG (Public Read, Staff Write)
-- =============================================
CREATE POLICY "Public view active products" ON products FOR SELECT USING (status = 'active' OR is_admin_or_staff());
CREATE POLICY "Staff manage products" ON products USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Public view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Staff manage categories" ON categories USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Public view variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Staff manage variants" ON product_variants USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Public view images" ON product_images FOR SELECT USING (true);
CREATE POLICY "Staff manage images" ON product_images USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- =============================================
-- ORDERS
-- =============================================
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No update/delete for users ideally, maybe cancel?
CREATE POLICY "Staff manage all orders" ON orders USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Users view own order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Staff manage order items" ON order_items USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Users view order history" ON order_status_history FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Staff manage order history" ON order_status_history USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- =============================================
-- CART & WISHLIST
-- =============================================
CREATE POLICY "Users manage own cart" ON cart_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own wishlist" ON wishlist_items USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- REVIEWS
-- =============================================
CREATE POLICY "Public view approved reviews" ON reviews FOR SELECT USING (status = 'approved');
CREATE POLICY "Users view own reviews" ON reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id); 
CREATE POLICY "Users update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Staff manage reviews" ON reviews USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Public view review images" ON review_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.status = 'approved')
);
CREATE POLICY "Users manage review images" ON review_images USING (
  EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM reviews WHERE reviews.id = review_images.review_id AND reviews.user_id = auth.uid())
);

-- =============================================
-- BLOG
-- =============================================
CREATE POLICY "Public view published posts" ON blog_posts FOR SELECT USING (status = 'published' OR is_admin_or_staff());
CREATE POLICY "Staff manage blog" ON blog_posts USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- =============================================
-- SUPPORT
-- =============================================
CREATE POLICY "Users manage own tickets" ON support_tickets USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage tickets" ON support_tickets USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Users view ticket messages" ON support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid())
);
CREATE POLICY "Users create messages" ON support_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM support_tickets WHERE support_tickets.id = ticket_id AND support_tickets.user_id = auth.uid())
);
CREATE POLICY "Staff manage messages" ON support_messages USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- =============================================
-- RETURNS
-- =============================================
CREATE POLICY "Users view own returns" ON return_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create returns" ON return_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff manage returns" ON return_requests USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Users view return items" ON return_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM return_requests WHERE return_requests.id = return_items.return_request_id AND return_requests.user_id = auth.uid())
);
CREATE POLICY "Staff manage return items" ON return_items USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

-- =============================================
-- SETTINGS & AUDIT
-- =============================================
CREATE POLICY "Staff view settings" ON store_settings FOR SELECT USING (true); -- Maybe public if needed?
CREATE POLICY "Staff manage settings" ON store_settings USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE POLICY "Staff view audit logs" ON audit_logs FOR SELECT USING (is_admin_or_staff());
-- Audit logs only inserted by system/triggers ideally, or staff?
CREATE POLICY "Staff insert audit logs" ON audit_logs FOR INSERT WITH CHECK (is_admin_or_staff());

-- =============================================
-- NOTIFICATIONS
-- =============================================
CREATE POLICY "Users manage own notifications" ON notifications USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

