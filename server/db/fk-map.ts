// Foreign-key map for Hy_stepper — drives PostgREST-style embeds in supabase-compat.
// Note: auth.users is referenced as foreignTable "users" in live FKs; we keep auth.users
// and also expose a public.users view OR map embeds to auth.users via fk-map.

export interface FkEdge {
  column: string;
  foreignTable: string;
  foreignColumn: string;
}

export const JSONB_COLUMNS: Record<string, Set<string>> = {
  addresses: new Set(["metadata"]),
  audit_logs: new Set(["details"]),
  categories: new Set(["metadata"]),
  cms_content: new Set(["metadata"]),
  coupons: new Set(["metadata"]),
  delivery_zones: new Set(["methods"]),
  notifications: new Set(["data"]),
  order_items: new Set(["metadata"]),
  orders: new Set(["billing_address", "metadata", "shipping_address"]),
  product_variants: new Set(["metadata"]),
  products: new Set(["metadata", "options"]),
  profiles: new Set(["preferences"]),
  site_settings: new Set(["value"]),
  staff: new Set(["permissions"]),
  store_settings: new Set(["value"]),
  support_messages: new Set(["attachments"]),
  support_tickets: new Set(["metadata"]),
};

// Owning table → FK edges. foreignTable "users" means auth.users (we create a
// public.users view pointing at auth.users so embeds resolve).
export const FK_MAP: Record<string, FkEdge[]> = {
  addresses: [{ column: "user_id", foreignTable: "users", foreignColumn: "id" }],
  audit_logs: [{ column: "user_id", foreignTable: "users", foreignColumn: "id" }],
  blog_posts: [{ column: "author_id", foreignTable: "users", foreignColumn: "id" }],
  cart_items: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "product_variants", foreignColumn: "id" },
  ],
  categories: [{ column: "parent_id", foreignTable: "categories", foreignColumn: "id" }],
  loyalty_points: [{ column: "user_id", foreignTable: "users", foreignColumn: "id" }],
  loyalty_transactions: [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  navigation_items: [
    { column: "menu_id", foreignTable: "navigation_menus", foreignColumn: "id" },
    { column: "parent_id", foreignTable: "navigation_items", foreignColumn: "id" },
  ],
  notifications: [{ column: "user_id", foreignTable: "users", foreignColumn: "id" }],
  order_items: [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "variant_id", foreignTable: "product_variants", foreignColumn: "id" },
  ],
  order_status_history: [
    { column: "created_by", foreignTable: "users", foreignColumn: "id" },
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
  ],
  orders: [
    { column: "rider_id", foreignTable: "users", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  product_images: [{ column: "product_id", foreignTable: "products", foreignColumn: "id" }],
  product_variants: [{ column: "product_id", foreignTable: "products", foreignColumn: "id" }],
  products: [{ column: "category_id", foreignTable: "categories", foreignColumn: "id" }],
  profiles: [{ column: "id", foreignTable: "users", foreignColumn: "id" }],
  return_items: [
    { column: "order_item_id", foreignTable: "order_items", foreignColumn: "id" },
    { column: "return_request_id", foreignTable: "return_requests", foreignColumn: "id" },
  ],
  return_requests: [
    { column: "order_id", foreignTable: "orders", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  review_images: [{ column: "review_id", foreignTable: "reviews", foreignColumn: "id" }],
  reviews: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  staff: [
    { column: "invited_by", foreignTable: "users", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  stock_movements: [{ column: "product_id", foreignTable: "products", foreignColumn: "id" }],
  stock_notifications: [{ column: "product_id", foreignTable: "products", foreignColumn: "id" }],
  store_settings: [{ column: "updated_by", foreignTable: "users", foreignColumn: "id" }],
  support_messages: [
    { column: "ticket_id", foreignTable: "support_tickets", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  support_tickets: [
    { column: "assigned_to", foreignTable: "users", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
  wishlist_items: [
    { column: "product_id", foreignTable: "products", foreignColumn: "id" },
    { column: "user_id", foreignTable: "users", foreignColumn: "id" },
  ],
};
