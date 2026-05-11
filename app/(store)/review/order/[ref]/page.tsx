import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const metadata: Metadata = {
  title: 'Leave a review — Hy_stepper',
  description: 'Tell us what you thought of your recent order.',
  robots: { index: false, follow: false },
};

// Always render fresh — order_items can change up until the moment the
// customer clicks the SMS link, and we don't want the chooser cached.
export const dynamic = 'force-dynamic';

type OrderItem = {
  product_name: string;
  product_id: string | null;
  metadata: { image?: string } | null;
  products: { slug: string | null; name: string | null } | null;
  product_images: { url: string; position: number }[];
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  order_items: OrderItem[];
};

async function fetchOrder(ref: string): Promise<OrderRow | null> {
  // The customer arrives here from an SMS we sent to *their* phone after
  // their order was delivered. They are usually NOT signed in, so the
  // public anon role can't read the order under existing RLS (orders
  // belonging to a registered customer are scoped to that user). We use
  // the service-role client server-side and only return non-sensitive
  // fields (product names + slugs + images) needed to render the chooser.
  // The order_number itself functions as the unguessable handle here, the
  // same way the order-success tracking link does.
  const supabase = supabaseAdmin;

  // Try by order_number first, then by id (covers both the human-readable
  // POS-xxx numbers used in SMS and direct UUID links).
  let query = await supabase
    .from('orders')
    .select(
      `id, order_number, status, created_at,
       order_items (
         product_name, product_id, metadata,
         products:product_id ( slug, name )
       )`,
    )
    .eq('order_number', ref)
    .maybeSingle();

  if (!query.data && /^[0-9a-fA-F-]{30,}$/.test(ref)) {
    query = await supabase
      .from('orders')
      .select(
        `id, order_number, status, created_at,
         order_items (
           product_name, product_id, metadata,
           products:product_id ( slug, name )
         )`,
      )
      .eq('id', ref)
      .maybeSingle();
  }

  if (!query.data) return null;

  // Pull a primary image per product in a separate query to avoid the
  // limit-per-foreign-table trick in nested selects.
  const productIds = (query.data.order_items || [])
    .map((it: any) => it.product_id)
    .filter(Boolean) as string[];

  let imagesByProduct: Record<string, string> = {};
  if (productIds.length > 0) {
    const { data: imgs } = await supabase
      .from('product_images')
      .select('product_id, url, position')
      .in('product_id', productIds)
      .order('position', { ascending: true });

    (imgs || []).forEach((row: any) => {
      if (!imagesByProduct[row.product_id]) {
        imagesByProduct[row.product_id] = row.url;
      }
    });
  }

  const items: OrderItem[] = (query.data.order_items || []).map((it: any) => ({
    product_name: it.product_name,
    product_id: it.product_id,
    metadata: it.metadata,
    products: Array.isArray(it.products) ? it.products[0] : it.products,
    product_images: imagesByProduct[it.product_id]
      ? [{ url: imagesByProduct[it.product_id], position: 0 }]
      : [],
  }));

  return {
    id: query.data.id,
    order_number: query.data.order_number,
    status: query.data.status,
    created_at: query.data.created_at,
    order_items: items,
  };
}

export default async function ReviewOrderPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const { ref } = await params;
  const order = await fetchOrder(decodeURIComponent(ref));

  if (!order) notFound();

  // De-duplicate items that appear multiple times in the same order
  const seen = new Set<string>();
  const items = order.order_items.filter((it) => {
    const key = it.products?.slug || it.product_id || it.product_name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gold-100 flex items-center justify-center">
            <i className="ri-star-smile-line text-3xl text-gold-600"></i>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            How was your order?
          </h1>
          <p className="text-gray-600 max-w-xl mx-auto">
            Thanks for shopping with Hy-Stepper! A quick review helps other shoppers and
            tells us what you loved (or didn&apos;t). Tap any item below to leave a review.
          </p>
          <p className="mt-4 text-xs uppercase tracking-wider text-gray-400">
            Order #{order.order_number}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
            <p className="text-gray-600">
              We couldn&apos;t find any reviewable items for this order.
            </p>
            <Link
              href="/shop"
              className="inline-block mt-6 px-6 py-3 bg-gray-900 hover:bg-gold-600 text-white rounded-lg font-medium transition-colors"
            >
              Back to shop
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => {
              const slug = item.products?.slug;
              const name = item.products?.name || item.product_name;
              const image =
                item.product_images?.[0]?.url ||
                item.metadata?.image ||
                'https://via.placeholder.com/120?text=Item';

              const reviewable = Boolean(slug);
              const href = reviewable ? `/product/${slug}?review=write#reviews` : '#';

              const Wrapper = reviewable ? Link : 'div';

              return (
                <Wrapper
                  key={idx}
                  {...(reviewable ? { href } : {})}
                  className={`flex items-center gap-4 bg-white rounded-2xl border border-gray-200 p-4 transition-shadow ${
                    reviewable
                      ? 'hover:shadow-md hover:border-gold-300 cursor-pointer'
                      : 'opacity-60'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image}
                    alt={name}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-gray-100 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{name}</p>
                    <p className="text-sm text-gray-500">
                      {reviewable
                        ? 'Tap to share your experience'
                        : 'No longer available for review'}
                    </p>
                  </div>
                  {reviewable && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-gold-50 text-gold-700 rounded-lg text-sm font-semibold whitespace-nowrap">
                      <i className="ri-star-line"></i>
                      Leave review
                    </span>
                  )}
                  <i
                    className={`ri-arrow-right-s-line text-2xl text-gray-400 sm:hidden ${
                      !reviewable ? 'invisible' : ''
                    }`}
                  ></i>
                </Wrapper>
              );
            })}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link
            href="/shop"
            className="text-sm text-gray-500 hover:text-gold-600 underline underline-offset-4"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
