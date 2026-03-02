/**
 * migrate_images_to_storage.js
 *
 * This script migrates all base64 product images stored in the database
 * to Supabase Storage, then updates the URLs in product_images table.
 *
 * Usage:
 *   1. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local
 *   2. Run: node scripts/migrate_images_to_storage.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env
const envPath = path.join(__dirname, '..', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SERVICE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  console.error('Add this line to .env.local:');
  console.error('SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here');
  console.error('\nYou can find it at: https://supabase.com/dashboard/project/_/settings/api');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function base64ToBuffer(dataUrl) {
  const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) return null;
  const mimeType = matches[1];
  const base64Data = matches[2];
  const buffer = Buffer.from(base64Data, 'base64');
  return { buffer, mimeType };
}

function getExtension(mimeType) {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return map[mimeType] || 'jpg';
}

async function run() {
  console.log('🚀 Starting image migration to Supabase Storage...\n');

  // 1. Ensure bucket exists
  const { error: bucketErr } = await supabase.storage.createBucket('products', {
    public: true,
    fileSizeLimit: 52428800, // 50MB
  });
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.error('Failed to create bucket:', bucketErr.message);
  } else {
    console.log('✅ Storage bucket "products" ready\n');
  }

  // 2. Fetch all product_images that are base64
  const { data: rows, error } = await supabase
    .from('product_images')
    .select('id, url, product_id')
    .ilike('url', 'data:%');

  if (error) { console.error('Error fetching images:', error.message); process.exit(1); }
  if (!rows || rows.length === 0) { console.log('✅ No base64 images found — nothing to migrate!'); return; }

  console.log(`Found ${rows.length} base64 image(s) to migrate...\n`);

  let success = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const parsed = base64ToBuffer(row.url);
      if (!parsed) {
        console.log(`⚠️  Skipping ${row.id} — could not parse base64`);
        failed++;
        continue;
      }

      const { buffer, mimeType } = parsed;
      const ext = getExtension(mimeType);
      const filePath = `products/${row.product_id}/${row.id}.${ext}`;

      // Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from('products')
        .upload(filePath, buffer, { contentType: mimeType, upsert: true });

      if (uploadErr) {
        console.log(`❌ Upload failed for ${row.id}: ${uploadErr.message}`);
        failed++;
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(filePath);

      // Update DB
      const { error: updateErr } = await supabase
        .from('product_images')
        .update({ url: publicUrl })
        .eq('id', row.id);

      if (updateErr) {
        console.log(`❌ DB update failed for ${row.id}: ${updateErr.message}`);
        failed++;
      } else {
        console.log(`✅ Migrated ${row.id} → ${publicUrl.substring(0, 80)}...`);
        success++;
      }
    } catch (err) {
      console.log(`❌ Error processing ${row.id}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n🎉 Done! ${success} migrated successfully, ${failed} failed.`);
  if (failed > 0) console.log('Re-run the script to retry failed items.');
}

run().catch(console.error);
