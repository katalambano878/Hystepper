'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/ProductCard';
import { useCMS } from '@/context/CMSContext';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hystepper.vercel.app';

export default function WishlistPage() {
  const { wishlist: wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { getSetting } = useCMS();

  // Read window.location.origin only on the client so the share links use
  // the live host (works on staging, custom domains, etc.) instead of the
  // fallback SITE_URL.
  const [shareOrigin, setShareOrigin] = useState<string>(SITE_URL);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      setShareOrigin(window.location.origin);
    }
  }, []);

  // The wishlist itself lives in localStorage so we can't really link a
  // friend to *this customer's* list. Instead the share message tells the
  // friend what the customer is loving and points them at the store.
  const siteName = getSetting('site_name') || 'Hy_stepper';
  const shareText = useMemo(() => {
    if (wishlistItems.length === 0) {
      return `Check out ${siteName} — premium footwear & accessories.`;
    }
    const firstFew = wishlistItems.slice(0, 3).map(i => i.name).filter(Boolean).join(', ');
    return `I'm loving these on ${siteName}: ${firstFew}${wishlistItems.length > 3 ? '…' : ''}`;
  }, [wishlistItems, siteName]);

  // Pre-compute share hrefs. Using real <a target="_blank"> elements instead
  // of window.open() so popup blockers and "translucent" mobile browsers
  // (Brave, in-app webviews) treat them as a normal user-initiated
  // navigation and never silently swallow the click.
  const shareLinks = useMemo(() => {
    const encodedText = encodeURIComponent(shareText);
    const encodedUrl = encodeURIComponent(shareOrigin);
    const encodedTextAndUrl = encodeURIComponent(`${shareText} ${shareOrigin}`);
    const encodedBody = encodeURIComponent(`${shareText}\n\n${shareOrigin}`);
    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodedTextAndUrl}`,
      email: `mailto:?subject=${encodeURIComponent('Check this out')}&body=${encodedBody}`,
    };
  }, [shareText, shareOrigin]);

  const addAllToCart = () => {
    const inStockItems = wishlistItems.filter(item => item.inStock);
    inStockItems.forEach(item => {
      // Convert WishlistItem to CartItem if necessary, or assume compatibility
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: 1,
        slug: item.slug || item.id, // Fallback
        maxStock: 99 // Default
      });
    });
    if (inStockItems.length > 0) {
      alert(`Added ${inStockItems.length} items to cart`);
    }
  };

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

      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="bg-gradient-to-r from-gold-600 to-gold-700 rounded-2xl p-12 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">Share Your Wishlist</h2>
            <p className="text-gold-100 mb-8 text-lg">Let friends and family know what you love</p>
            <div className="flex justify-center space-x-4">
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer text-white"
              >
                <i className="ri-facebook-fill text-xl"></i>
              </a>
              <a
                href={shareLinks.x}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer text-white"
              >
                <i className="ri-twitter-x-fill text-xl"></i>
              </a>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                data-action="share/whatsapp/share"
                className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer text-white"
              >
                <i className="ri-whatsapp-fill text-xl"></i>
              </a>
              <a
                href={shareLinks.email}
                aria-label="Share by email"
                className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer text-white"
              >
                <i className="ri-mail-fill text-xl"></i>
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
