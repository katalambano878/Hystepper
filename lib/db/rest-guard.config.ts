// Which tables the browser may read and write through /rest/v1 for this shop.
// Everything not listed here is staff-only. See rest-guard.ts for the rules.

export interface GuardConfig {
  /** profiles.role values (lower case) with full access. */
  staffRoles: string[];
  /** SQL returning one row with a `role` column for the user id in $1. */
  staffRoleSql: string;
  /** Catalogue / CMS tables anyone may read. */
  publicRead: string[];
  /** Column names removed (at any depth) from every non-staff read, e.g. cost prices. */
  hiddenColumnNames: string[];
  /** Rows removed from non-staff reads, e.g. site_settings key admin_pin. */
  hiddenRows: Record<string, { column: string; values: string[] }>;
  /** Rows a signed-in customer owns: reads and own-mode writes are pinned to them. */
  ownRows: Record<string, { userColumn: string; emailColumn?: string }>;
  /** Tables readable through a parent row the caller may read (order_items under orders). */
  ownChildren: Record<string, { parent: string; fk: string }>;
  /** One row readable by anyone with its exact value in one of these columns. */
  guestLookup: Record<string, { columns: string[]; patterns: Record<string, RegExp> }>;
  /** "parent>child": columns of a staff-only table that may be embedded under a public one. */
  publicEmbeds: Record<string, string[]>;
  /**
   * Browser writes allowed for non-staff callers.
   *   insert: "anyone" | "user" (signed in) | "own" (owner column forced) |
   *           "childOfNewOrder" (only into the caller's own new unpaid order)
   *   update / delete: "own" (pinned to the caller's rows)
   *   upsertOn: conflict columns that make an own-mode upsert safe
   *   ownerColumn: the user-id column of a table not listed in ownRows
   *     (e.g. reviews.user_id), so rows cannot be written for someone else
   */
  write: Record<
    string,
    {
      insert?: "anyone" | "user" | "own" | "childOfNewOrder";
      update?: "own";
      delete?: "own";
      upsertOn?: string[];
      ownerColumn?: string;
    }
  >;
  /** Columns dropped from non-staff inserts and updates. */
  protectedColumns: Record<string, string[]>;
  /** For childOfNewOrder: how new the order must be, and SQL that is true while it is unpaid. */
  childWrite?: { maxAgeMinutes: number; unpaidSql: string };
  /** RPCs non-staff may call. */
  rpc: Record<string, "anyone" | "user">;
  /** Storage buckets signed-in customers may upload to. */
  userUploadBuckets: string[];
}

// This shop's /rest/v1 is a proxy to PostgREST, which applies the database's
// row-level security policies. The guard sits in front of that and closes what
// the policies leave open: the public `users` view (all sign-up emails), the
// `pages` table (no RLS), customers changing their own orders' payment fields
// or approving their own reviews, self-awarded loyalty transactions, the
// coupon list, and SECURITY DEFINER functions callable by anyone.

export const REST_GUARD: GuardConfig = {
  // Admin layout: profiles.role 'admin', or an active row in public.staff
  // (admin / manager / staff / rider). Riders pass the guard; the database
  // policies behind it still limit them to their assigned orders.
  staffRoles: ["admin", "staff", "manager", "rider"],
  staffRoleSql: `SELECT COALESCE(
      (SELECT p.role::text FROM public.profiles p WHERE p.id = $1 AND p.role::text IN ('admin', 'staff')),
      (SELECT s.role::text FROM public.staff s WHERE s.user_id = $1 AND s.is_active IS TRUE
        ORDER BY CASE s.role::text WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 WHEN 'staff' THEN 2 ELSE 3 END
        LIMIT 1)
    ) AS role`,
  publicRead: [
    "banners",
    "blog_posts",
    "categories",
    "cms_content",
    "delivery_zones",
    "navigation_items",
    "navigation_menus",
    "pages",
    "product_bundles",
    "product_images",
    "product_variants",
    "products",
    "review_images",
    "reviews",
    "site_settings",
    "store_modules",
    "store_settings",
  ],
  hiddenColumnNames: ["cost_per_item"],
  hiddenRows: {
    site_settings: { column: "key", values: ["admin_pin"] },
    store_settings: { column: "key", values: ["admin_pin"] },
  },
  ownRows: {
    addresses: { userColumn: "user_id" },
    cart_items: { userColumn: "user_id" },
    loyalty_points: { userColumn: "user_id" },
    loyalty_transactions: { userColumn: "user_id" },
    notifications: { userColumn: "user_id" },
    orders: { userColumn: "user_id" },
    profiles: { userColumn: "id" },
    return_requests: { userColumn: "user_id" },
    support_tickets: { userColumn: "user_id" },
    wishlist_items: { userColumn: "user_id" },
  },
  ownChildren: {
    order_items: { parent: "orders", fk: "order_id" },
    order_status_history: { parent: "orders", fk: "order_id" },
    return_items: { parent: "return_requests", fk: "return_request_id" },
    support_messages: { parent: "support_tickets", fk: "ticket_id" },
  },
  // No guest order lookup here: order numbers include POS-<timestamp> with no
  // random part, and the order-success page reads through /api/orders/lookup.
  // Checkout looks up one coupon by its exact code.
  guestLookup: {
    coupons: { columns: ["code"], patterns: {} },
  },
  publicEmbeds: {},
  // Checkout, payment and contact go through server routes; these are the
  // browser writes the storefront makes.
  write: {
    addresses: { insert: "own", update: "own", delete: "own" },
    profiles: { update: "own" },
    reviews: { insert: "anyone", ownerColumn: "user_id" },
    stock_notifications: { insert: "anyone" },
  },
  protectedColumns: {
    profiles: ["role", "email"],
    reviews: ["verified_purchase", "helpful_votes"],
    stock_notifications: ["notified", "notified_at"],
  },
  childWrite: { maxAgeMinutes: 120, unpaidSql: "COALESCE(payment_status::text, 'pending') <> 'paid'" },
  rpc: {},
  userUploadBuckets: [],
};
