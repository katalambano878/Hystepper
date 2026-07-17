#!/usr/bin/env node
/**
 * Import migration-artifacts/data/*.json into plain Postgres.
 * Usage: DATABASE_URL=postgres://... node import-data.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });
await client.connect();

const ORDER = [
  "auth_users", // special → auth.users
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

function quoteIdent(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

async function getColumns(schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=$1 AND table_name=$2`,
    [schema, table]
  );
  return new Set(rows.map((r) => r.column_name));
}

async function truncateCascade(schema, table) {
  await client.query(`TRUNCATE TABLE ${quoteIdent(schema)}.${quoteIdent(table)} CASCADE`);
}

async function getJsonbColumns(schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema=$1 AND table_name=$2 AND data_type='jsonb'`,
    [schema, table]
  );
  return new Set(rows.map((r) => r.column_name));
}

async function insertRows(schema, table, rows) {
  if (!rows.length) return 0;
  const cols = await getColumns(schema, table);
  const jsonbCols = await getJsonbColumns(schema, table);
  const keys = Object.keys(rows[0]).filter((k) => cols.has(k));
  if (!keys.length) throw new Error(`No matching columns for ${schema}.${table}`);

  let inserted = 0;
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const values = [];
    const params = [];
    let p = 1;
    for (const row of chunk) {
      const placeholders = [];
      for (const k of keys) {
        let v = row[k];
        if (jsonbCols.has(k)) {
          // jsonb must be JSON text (scalars included: '"true"', '[]', '{}')
          v = JSON.stringify(v);
        } else if (Array.isArray(v)) {
          // native Postgres arrays (text[], etc.) — leave as JS array
        } else if (v !== null && typeof v === "object" && !(v instanceof Date)) {
          v = JSON.stringify(v);
        }
        placeholders.push(`$${p++}`);
        params.push(v);
      }
      values.push(`(${placeholders.join(",")})`);
    }
    const sql = `INSERT INTO ${quoteIdent(schema)}.${quoteIdent(table)} (${keys
      .map(quoteIdent)
      .join(",")}) VALUES ${values.join(",")} ON CONFLICT DO NOTHING`;
    await client.query(sql, params);
    inserted += chunk.length;
  }
  return inserted;
}

await client.query("SET session_replication_role = replica"); // disable triggers during load

// Clear in reverse-ish order via truncate of dependents — truncate auth.users cascades carefully
// Prefer truncate leaf tables first is hard; use CASCADE from auth.users after profiles...
// Safer: truncate each public table then auth.users
for (const t of [...ORDER].reverse()) {
  if (t === "auth_users") continue;
  const file = path.join(dataDir, `${t}.json`);
  if (!fs.existsSync(file)) continue;
  try {
    await client.query(`TRUNCATE TABLE public.${quoteIdent(t)} CASCADE`);
  } catch (e) {
    console.warn("truncate skip", t, e.message);
  }
}
try {
  await client.query(`TRUNCATE TABLE auth.users CASCADE`);
} catch (e) {
  console.warn("truncate auth.users", e.message);
}

for (const t of ORDER) {
  const file = path.join(dataDir, `${t}.json`);
  if (!fs.existsSync(file)) {
    console.log(`skip missing ${t}`);
    continue;
  }
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) {
    console.error("bad json", t);
    continue;
  }
  try {
    if (t === "auth_users") {
      const n = await insertRows("auth", "users", rows);
      console.log(`✓ auth.users: ${n}`);
    } else {
      const n = await insertRows("public", t, rows);
      console.log(`✓ ${t}: ${n}`);
    }
  } catch (e) {
    console.error(`✗ ${t}:`, e.message);
  }
}

await client.query("SET session_replication_role = DEFAULT");

// Sync sequences
const { rows: seqs } = await client.query(`
  SELECT table_name, column_name,
    pg_get_serial_sequence(format('%I.%I', table_schema, table_name), column_name) AS seq
  FROM information_schema.columns
  WHERE table_schema='public' AND column_default LIKE 'nextval%'
`);
for (const s of seqs) {
  if (!s.seq) continue;
  await client.query(
    `SELECT setval($1::regclass, COALESCE((SELECT MAX(${quoteIdent(s.column_name)}) FROM public.${quoteIdent(
      s.table_name
    )}), 1))`,
    [s.seq]
  );
}

await client.end();
console.log("Import complete");
