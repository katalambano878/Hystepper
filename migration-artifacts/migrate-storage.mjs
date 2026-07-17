#!/usr/bin/env node
/**
 * Mirror Supabase Storage bucket `products` → local STORAGE_ROOT/products
 * and rewrite absolute supabase URLs in the DB to the new public path.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnv() {
  const env = { ...process.env };
  try {
    for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      env[t.slice(0, i)] = t.slice(i + 1).replace(/^["']|["']$/g, "");
    }
  } catch {}
  return env;
}

const env = loadEnv();
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const OUT = env.STORAGE_ROOT || path.join(root, ".storage");
const NEW_BASE = (env.STORAGE_PUBLIC_URL || env.NEXT_PUBLIC_APP_URL || "https://hystepper.com").replace(/\/$/, "");
const OLD_HOST = "rwsentatgbmxlfaecnqm.supabase.co";

async function listAll(prefix = "") {
  const url = `${BASE}/storage/v1/object/list/products`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefix, limit: 1000 }),
  });
  if (!res.ok) throw new Error(`list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function walk(prefix = "") {
  const items = await listAll(prefix);
  const files = [];
  for (const it of items) {
    const name = it.name;
    if (it.id === null) {
      // folder
      files.push(...(await walk(prefix ? `${prefix}/${name}` : name)));
    } else {
      files.push(prefix ? `${prefix}/${name}` : name);
    }
  }
  return files;
}

async function download(objectPath) {
  const url = `${BASE}/storage/v1/object/public/products/${objectPath.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url);
  if (!res.ok) {
    // try authenticated
    const res2 = await fetch(`${BASE}/storage/v1/object/products/${objectPath}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!res2.ok) throw new Error(`download ${objectPath}: ${res2.status}`);
    return { buf: Buffer.from(await res2.arrayBuffer()), ct: res2.headers.get("content-type") || "application/octet-stream" };
  }
  return { buf: Buffer.from(await res.arrayBuffer()), ct: res.headers.get("content-type") || "application/octet-stream" };
}

const files = await walk("");
console.log("objects:", files.length);
fs.mkdirSync(path.join(OUT, "products"), { recursive: true });
let ok = 0;
for (const f of files) {
  try {
    const { buf, ct } = await download(f);
    const dest = path.join(OUT, "products", f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    fs.writeFileSync(dest + ".meta.json", JSON.stringify({ contentType: ct }));
    ok++;
    if (ok % 25 === 0) console.log(`… ${ok}/${files.length}`);
  } catch (e) {
    console.error("fail", f, e.message);
  }
}
console.log(`downloaded ${ok}/${files.length} → ${OUT}/products`);

if (process.env.DATABASE_URL) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const repl = `${NEW_BASE}/storage/v1/object/public/products`;
  const old1 = `https://${OLD_HOST}/storage/v1/object/public/products`;
  const old2 = `${BASE}/storage/v1/object/public/products`;
  for (const [table, col] of [
    ["products", "image_url"],
    ["product_images", "url"],
    ["categories", "image_url"],
    ["banners", "image_url"],
  ]) {
    try {
      const r = await client.query(
        `UPDATE ${table} SET ${col} = replace(replace(${col}, $1, $3), $2, $3) WHERE ${col} IS NOT NULL`,
        [old1, old2, repl]
      );
      console.log(`rewrote ${table}.${col}:`, r.rowCount);
    } catch (e) {
      console.warn(`skip ${table}.${col}:`, e.message);
    }
  }
  // Also scan jsonb metadata / options lightly
  await client.end();
}
console.log("done");
