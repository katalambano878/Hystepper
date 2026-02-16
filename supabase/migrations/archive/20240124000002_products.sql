-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE product_status AS ENUM ('active', 'draft', 'archived');
CREATE TYPE category_status AS ENUM ('active', 'inactive');

-- =============================================
-- CATEGORIES
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_url TEXT,
  position INTEGER DEFAULT 0,
  status category_status DEFAULT 'active',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCTS
-- =============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  
  -- Pricing & Inventory
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_per_item DECIMAL(10,2),
  sku TEXT UNIQUE,
  barcode TEXT,
  
  -- Inventory Management
  quantity INTEGER DEFAULT 0,
  track_quantity BOOLEAN DEFAULT true,
  continue_selling BOOLEAN DEFAULT false,
  
  -- Shipping
  weight DECIMAL(10,2),
  weight_unit TEXT DEFAULT 'kg',
  
  -- Organization
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand TEXT,
  vendor TEXT,
  tags TEXT[],
  
  -- Status
  status product_status DEFAULT 'active',
  featured BOOLEAN DEFAULT false,
  
  -- Options configuration (e.g. [{"name": "Size", "values": ["S", "M"]}, {"name": "Color", "values": ["Red"]}])
  options JSONB DEFAULT '[]'::jsonb,
  
  -- External Sync (e.g. Shopify)
  external_id TEXT,
  external_source TEXT,
  
  -- SEO
  seo_title TEXT,
  seo_description TEXT,
  
  -- Stats (Denormalized for performance)
  rating_avg DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCT IMAGES
-- =============================================
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  alt_text TEXT,
  position INTEGER DEFAULT 0,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PRODUCT VARIANTS
-- =============================================
CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "Small / Red"
  
  sku TEXT UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_per_item DECIMAL(10,2),
  
  quantity INTEGER DEFAULT 0,
  weight DECIMAL(10,2),
  
  -- Option values corresponding to product.options
  option1 TEXT, -- e.g. "Small"
  option2 TEXT, -- e.g. "Red"
  option3 TEXT,
  
  image_url TEXT,
  barcode TEXT,
  
  external_id TEXT,
  
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(featured);
CREATE INDEX idx_products_tags ON products USING GIN(tags);
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);
