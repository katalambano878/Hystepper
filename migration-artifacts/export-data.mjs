#!/usr/bin/env node
/**
 * Export all public table data from hosted Supabase via PostgREST (service role).
 * Writes JSON files to migration-artifacts/data/<table>.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const env = {};
  const raw = fs.readFileSync(path.join(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  "categories",
  "profiles",
  "store_settings",
  "site_settings",
  "cms_content",
  "banners",
  "navigation_menus",
  "navigation_items",
  "pages",
  "delivery_zones",
  "products",
  "product_images",
  "product_variants",
  "coupons",
  "staff",
  "addresses",
  "orders",
  "order_items",
  "order_status_history",
  "cart_items",
  "wishlist_items",
  "reviews",
  "review_images",
  "loyalty_points",
  "loyalty_transactions",
  "blog_posts",
  "support_tickets",
  "support_messages",
  "return_requests",
  "return_items",
  "notifications",
  "audit_logs",
  "stock_notifications",
  "stock_movements",
];

const outDir = path.join(__dirname, "data");
fs.mkdirSync(outDir, { recursive: true });

async function fetchAll(table) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  for (;;) {
    const to = from + pageSize - 1;
    const url = `${BASE}/rest/v1/${table}?select=*&order=id.asc&offset=${from}&limit=${pageSize}`;
    const res = await fetch(url, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Prefer: "count=exact",
        Range: `${from}-${to}`,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      // Some tables may lack `id` or use different PK — retry without order
      if (res.status === 400 && body.includes("order")) {
        const res2 = await fetch(`${BASE}/rest/v1/${table}?select=*`, {
          headers: {
            apikey: KEY,
            Authorization: `Bearer ${KEY}`,
          },
        });
        if (!res2.ok) throw new Error(`${table}: ${res2.status} ${await res2.text()}`);
        return await res2.json();
      }
      throw new Error(`${table}: ${res.status} ${body}`);
    }
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

const summary = {};
for (const table of TABLES) {
  try {
    const rows = await fetchAll(table);
    fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows));
    summary[table] = rows.length;
    console.log(`✓ ${table}: ${rows.length}`);
  } catch (e) {
    summary[table] = `ERROR: ${e.message}`;
    console.error(`✗ ${table}: ${e.message}`);
  }
}
fs.writeFileSync(path.join(__dirname, "data-summary.json"), JSON.stringify(summary, null, 2));
console.log("Done.", summary);
