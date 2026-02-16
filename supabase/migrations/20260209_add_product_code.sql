-- Add product_code column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_code TEXT;

-- Add index for product_code
CREATE INDEX IF NOT EXISTS idx_products_product_code 
ON products (product_code);
