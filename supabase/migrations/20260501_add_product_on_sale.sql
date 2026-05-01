-- Add on_sale toggle to products so admins can curate which items appear on /sale
ALTER TABLE products
ADD COLUMN IF NOT EXISTS on_sale BOOLEAN DEFAULT false;

-- Filtered partial index keeps the /sale page query fast even on large catalogs
CREATE INDEX IF NOT EXISTS idx_products_on_sale
ON products (on_sale)
WHERE on_sale = true;
