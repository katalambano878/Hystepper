'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/ProductCard';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.hystepper.com';
const MAX_SHARED_ITEMS = 20;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type SharedProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  quantity: number;
  rating_avg: number | null;
  review_count: number | null;
  product_images: { url: string; position: number }[] | null;
};

function WishlistContent() {
  const { wishlist: wishlistItems, removeFromWishlist, addToWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { getSetting } = useCMS();
  const searchParams = useSearchParams();

  const sharedIdsParam = (searchParams.get('ids') || '').trim();
  const sharedIds = useMemo(() => {
    if (!sharedIdsParam) return [];
    return sharedIdsParam
      .split(',')
      .map(s => s.trim())
      .filter(s => UUID_RE.test(s))
      .slice(0, MAX_SHARED_ITEMS);
  }, [sharedIdsParam]);

  const isSharedView = sharedIds.length > 0;

  // Shared-view: pull the actual products from the DB so the recipient sees
  // real wishlist items (image, price, link) instead of a generic message.
  const [sharedProducts, setSharedProducts] = useState<SharedProduct[]>([]);
  const [sharedLoading, setSharedLoading] = useState(false);
  useEffect(() => {
    if (!isSharedView) {
      setSharedProducts([]);
      return;
    }
    let cancelled = false;
    setSharedLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('products')
        .select(
          'id, name, slug, price, compare_at_price, quantity, rating_avg, review_count, product_images!product_id(url, position)'
        )
        .in('id', sharedIds)
        .eq('status', 'active')
        .order('position', { foreignTable: 'product_images', ascending: true });

      if (cancelled) return;
      if (error || !data) {
        setSharedProducts([]);
      } else {
        // Preserve the order from the URL so the share looks like the sender
        // arranged it, not whatever order Postgres happens to return.
        const byId = new Map(data.map((p: any) => [p.id, p as SharedProduct]));
        const ordered = sharedIds
          .map(id => byId.get(id))
          .filter(Boolean) as SharedProduct[];
        setSharedProducts(ordered);
      }
      setSharedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isSharedView, sharedIds]);

  // Use the live origin so share links work on custom domains, staging, etc.
  const [origin, setOrigin] = useState<string>(SITE_URL);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setOrigin(window.location.origin);
    }
  }, []);

  const siteName = getSetting('site_name') || 'Hy_stepper';

  const shareData = useMemo(() => {
    const ids = wishlistItems
      .slice(0, MAX_SHARED_ITEMS)
      .map(i => i.id)
      .filter(id => UUID_RE.test(id))
      .join(',');
    const url = ids ? `${origin}/wishlist?ids=${ids}` : origin;
    const text =
      wishlistItems.length === 0
        ? `Check out ${siteName} — premium footwear & accessories.`
        : `Take a look at my wishlist on ${siteName} — these are the picks I'm loving:`;
    return { url, text };
  }, [wishlistItems, origin, siteName]);

  const shareLinks = useMemo(() => {
    const encodedText = encodeURIComponent(shareData.text);
    const encodedUrl = encodeURIComponent(shareData.url);
    const encodedTextAndUrl = encodeURIComponent(`${shareData.text} ${shareData.url}`);
    const encodedBody = encodeURIComponent(`${shareData.text}\n\n${shareData.url}`);
    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedTextAndUrl}`,
      email: `mailto:?subject=${encodeURIComponent(`My wishlist on ${siteName}`)}&body=${encodedBody}`,
    };
  }, [shareData, siteName]);

  // Native Web Share is much nicer on mobile — gives the user their
  // device-level share sheet (Messages, AirDrop, Slack, anything they have).
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== 'undefined' && typeof (navigator as any).share === 'function'
    );
  }, []);
  const handleNativeShare = async () => {
    try {
      await (navigator as any).share({
        title: `My wishlist on ${siteName}`,
        text: shareData.text,
        url: shareData.url,
      });
    } catch {
      // User cancelled or share failed — swallow, no UX needed.
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareData.url);
      setCopied(true);
      toast.success('Wishlist link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const saveSharedToMyWishlist = () => {
    if (sharedProducts.length === 0) return;
    let added = 0;
    sharedProducts.forEach(p => {
      const image = p.product_images?.[0]?.url || '';
      addToWishlist({
        id: p.id,
        name: p.name,
        price: Number(p.price) || 0,
        originalPrice:
          p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
            ? Number(p.compare_at_price)
            : undefined,
        image,
        rating: p.rating_avg ?? 5,
        reviewCount: p.review_count ?? 0,
        inStock: (p.quantity || 0) > 0,
        slug: p.slug,
      });
      added++;
    });
    toast.success(`Saved ${added} ${added === 1 ? 'item' : 'items'} to your wishlist`);
  };

  const addAllToCart = () => {
    const inStockItems = wishlistItems.filter(item => item.inStock);
    inStockItems.forEach(item => {
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: 1,
        slug: item.slug || item.id,
        maxStock: 99,
      });
    });
    if (inStockItems.length > 0) {
      toast.success(`Added ${inStockItems.length} ${inStockItems.length === 1 ? 'item' : 'items'} to cart`);
    }
  };

  // ============================================================
  // Shared-view mode: someone opened ?ids=... — show their picks.
  // ============================================================
  if (isSharedView) {
    return (
      <main className="min-h-screen bg-gray-50">
        <PageHero title="Shared Wishlist" />

        <section className="py-8 bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <nav className="flex items-center space-x-2 text-sm mb-2">
                  <Link href="/" className="text-gray-600 hover:text-gold-600 transition-colors">Home</Link>
                  <i className="ri-arrow-right-s-line text-gray-400"></i>
                  <span className="text-gray-900 font-medium">Shared Wishlist</span>
                </nav>
                <h2 className="text-2xl font-bold text-gray-900">Someone shared their wishlist with you</h2>
                <p className="text-gray-600 mt-1">
                  Tap any item to view it, or save the whole list to your own wishlist.
                </p>
              </div>
              {sharedProducts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveSharedToMyWishlist}
                    className="bg-gray-900 hover:bg-gold-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    <i className="ri-heart-add-line mr-2"></i>Save All to My Wishlist
                  </button>
                  <Link
                    href="/wishlist"
                    className="bg-white border border-gray-300 hover:border-gold-500 text-gray-900 px-5 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
                  >
                    View My Wishlist
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        {sharedLoading ? (
          <section className="py-20 text-center">
            <i className="ri-loader-4-line text-4xl text-gold-600 animate-spin"></i>
          </section>
        ) : sharedProducts.length === 0 ? (
          <section className="py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-200 rounded-full">
                <i className="ri-heart-line text-5xl text-gray-400"></i>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">This wishlist isn&apos;t available</h2>
              <p className="text-gray-600 mb-8">The items may have been removed or are no longer in stock.</p>
              <Link
                href="/shop"
                className="inline-block bg-gray-900 hover:bg-gold-600 text-white px-8 py-4 rounded-lg font-semibold transition-colors"
              >
                Browse our store
              </Link>
            </div>
          </section>
        ) : (
          <section className="py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                {sharedProducts.map(p => {
                  const image = p.product_images?.[0]?.url || '';
                  return (
                    <ProductCard
                      key={p.id}
                      id={p.slug || p.id}
                      name={p.name}
                      price={Number(p.price) || 0}
                      originalPrice={
                        p.compare_at_price && Number(p.compare_at_price) > Number(p.price)
                          ? Number(p.compare_at_price)
                          : undefined
                      }
                      image={image}
                      rating={p.rating_avg ?? 5}
                      reviewCount={p.review_count ?? 0}
                      inStock={(p.quantity || 0) > 0}
                    />
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
    );
  }

  // ============================================================
  // Normal wishlist mode.
  // ============================================================
  return (
    <main className="min-h-screen bg-gray-50">
      <PageHero title="My Wishlist" />

      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm mb-2">
                <Link href="/" className="text-gray-600 hover:text-gold-600 transition-colors">Home</Link>
                <i className="ri-arrow-right-s-line text-gray-400"></i>
                <span className="text-gray-900 font-medium">Wishlist</span>
              </nav>
              <p className="text-gray-600">
                {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>
            {wishlistItems.length > 0 && (
              <button
                onClick={addAllToCart}
                className="bg-gray-900 hover:bg-gold-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Add All to Cart
              </button>
            )}
          </div>
        </div>
      </section>

      {wishlistItems.length === 0 ? (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-200 rounded-full">
              <i className="ri-heart-line text-5xl text-gray-400"></i>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your wishlist is empty</h2>
            <p className="text-gray-600 mb-8 text-lg">Save your favourite items here to easily find them later</p>
            <Link href="/shop" className="inline-block bg-gray-900 hover:bg-gold-600 text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap">
              Explore Products
            </Link>
          </div>
        </section>
      ) : (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {wishlistItems.map((product) => (
                <div key={product.id} className="relative">
                  <ProductCard {...product} />
                  <button
                    onClick={() => removeFromWishlist(product.id)}
                    className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-red-50 transition-colors z-10"
                  >
                    <i className="ri-close-line text-gray-700 text-xl"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {wishlistItems.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="bg-gradient-to-r from-gold-600 to-gold-700 rounded-2xl p-10 sm:p-12 text-center text-white">
              <h2 className="text-3xl font-bold mb-3">Share Your Wishlist</h2>
              <p className="text-gold-100 mb-2 text-lg">
                Send your picks to friends &amp; family — they&apos;ll see the exact same items.
              </p>
              <div className="flex flex-wrap justify-center items-center gap-3 mt-8">
                {canNativeShare && (
                  <button
                    onClick={handleNativeShare}
                    className="flex items-center gap-2 bg-white text-gold-700 hover:bg-gold-50 px-5 h-12 rounded-lg font-semibold transition-colors"
                    aria-label="Share"
                  >
                    <i className="ri-share-line text-xl"></i>
                    <span>Share</span>
                  </button>
                )}
                <a
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on Facebook"
                  className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                >
                  <i className="ri-facebook-fill text-xl"></i>
                </a>
                <a
                  href={shareLinks.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on X"
                  className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                >
                  <i className="ri-twitter-x-fill text-xl"></i>
                </a>
                <a
                  href={shareLinks.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Share on WhatsApp"
                  data-action="share/whatsapp/share"
                  className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                >
                  <i className="ri-whatsapp-fill text-xl"></i>
                </a>
                <a
                  href={shareLinks.email}
                  aria-label="Share by email"
                  className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                >
                  <i className="ri-mail-fill text-xl"></i>
                </a>
                <button
                  type="button"
                  onClick={handleCopy}
                  aria-label="Copy share link"
                  className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-white"
                >
                  <i className={`${copied ? 'ri-check-line' : 'ri-link'} text-xl`}></i>
                </button>
              </div>
              {wishlistItems.length > MAX_SHARED_ITEMS && (
                <p className="text-gold-100/80 text-xs mt-4">
                  Only the first {MAX_SHARED_ITEMS} items will be included in the share link.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default function WishlistPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <WishlistContent />
    </Suspense>
  );
}
