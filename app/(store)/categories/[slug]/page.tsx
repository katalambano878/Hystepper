import { redirect, notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/** Normalize for fuzzy match: "Shoes", "shoes", "women-s-sandals" comparisons. */
function normalizeKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Legacy / external links hit `/categories/shoes` (category name) while the
 * storefront lists products at `/shop?category={slug}`. Resolve by slug or
 * name and send shoppers to the real listing.
 */
export default async function CategorySlugRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: raw } = await params;
  const slug = decodeURIComponent(raw || '').trim();
  if (!slug) notFound();

  const { data: categories } = await supabase
    .from('categories')
    .select('slug, name, status')
    .eq('status', 'active');

  const needle = normalizeKey(slug);
  const match = (categories || []).find((c) => {
    return (
      normalizeKey(c.slug) === needle ||
      normalizeKey(c.name) === needle ||
      // Legacy Shoes slug before it was renamed to `shoes`
      (needle === 'women-s-sandals' && normalizeKey(c.slug) === 'shoes')
    );
  });

  if (match?.slug) {
    redirect(`/shop?category=${encodeURIComponent(match.slug)}`);
  }

  // Unknown category — still land on shop rather than a dead 404.
  redirect(`/shop?search=${encodeURIComponent(slug.replace(/-/g, ' '))}`);
}
