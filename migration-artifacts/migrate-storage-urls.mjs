#!/usr/bin/env node
/** Download every product image/video URL referenced in exported data. */
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
const OUT = env.STORAGE_ROOT || path.join(root, ".storage");
const NEW_BASE = (env.STORAGE_PUBLIC_URL || "https://hystepper.com").replace(/\/$/, "");
const OLD = "https://rwsentatgbmxlfaecnqm.supabase.co/storage/v1/object/public/products/";

const urls = new Set();
for (const file of ["products.json", "product_images.json", "categories.json", "banners.json"]) {
  const p = path.join(__dirname, "data", file);
  if (!fs.existsSync(p)) continue;
  for (const row of JSON.parse(fs.readFileSync(p, "utf8"))) {
    for (const k of ["image_url", "url", "image"]) {
      if (row[k] && String(row[k]).includes("/storage/")) urls.add(String(row[k]));
    }
  }
}
console.log("urls to fetch:", urls.size);

let ok = 0, fail = 0;
for (const url of urls) {
  try {
    const idx = url.indexOf("/object/public/products/");
    if (idx < 0) continue;
    const objectPath = decodeURIComponent(url.slice(idx + "/object/public/products/".length));
    const dest = path.join(OUT, "products", objectPath);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      ok++;
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const buf = Buffer.from(await res.arrayBuffer());
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    fs.writeFileSync(
      dest + ".meta.json",
      JSON.stringify({ contentType: res.headers.get("content-type") || "application/octet-stream" })
    );
    ok++;
    if (ok % 20 === 0) console.log(`… ${ok}`);
  } catch (e) {
    fail++;
    console.error("fail", url.slice(-60), e.message);
  }
}
console.log(`downloaded ok=${ok} fail=${fail}`);

if (process.env.DATABASE_URL) {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const repl = `${NEW_BASE}/storage/v1/object/public/products`;
  for (const [table, col] of [
    ["products", "image_url"],
    ["product_images", "url"],
    ["categories", "image_url"],
  ]) {
    try {
      const r = await client.query(
        `UPDATE ${table} SET ${col} = replace(${col}, $1, $2) WHERE ${col} LIKE $3`,
        [OLD.replace(/\/$/, ""), repl, "%supabase.co/storage%"]
      );
      console.log(`rewrote ${table}.${col}:`, r.rowCount);
    } catch (e) {
      console.warn(table, e.message);
    }
  }
  await client.end();
}
console.log("done");
