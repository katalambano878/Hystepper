'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/ProductCard';
import { useCMS } from '@/context/CMSContext';

export default function WishlistPage() {
  const { wishlist: wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { getSetting } = useCMS();

  // Brand social links, sourced from admin settings. Each entry is only
  // surfaced if the corresponding setting has been filled in, so we never
  // render a dead icon.
  const followLinks = useMemo(() => {
    const facebook = (getSetting('social_facebook') || '').trim();
    const instagram = (getSetting('social_instagram') || '').trim();
    const tiktok = (getSetting('social_tiktok') || '').trim();
    const rawWhatsapp = (getSetting('whatsapp_number') || '').trim();
    const email = (getSetting('contact_email') || '').trim();

    const whatsappDigits = rawWhatsapp.replace(/\D/g, '');
    const whatsapp = whatsappDigits ? `https://wa.me/${whatsappDigits}` : '';

    return [
      { key: 'instagram', href: instagram, icon: 'ri-instagram-line', label: 'Instagram' },
      { key: 'facebook',  href: facebook,  icon: 'ri-facebook-fill',  label: 'Facebook' },
      { key: 'tiktok',    href: tiktok,    icon: 'ri-tiktok-fill',    label: 'TikTok' },
      { key: 'whatsapp',  href: whatsapp,  icon: 'ri-whatsapp-fill',  label: 'WhatsApp' },
      { key: 'email',     href: email ? `mailto:${email}` : '', icon: 'ri-mail-fill', label: 'Email' },
    ].filter(link => link.href);
  }, [getSetting]);

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

      {followLinks.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="bg-gradient-to-r from-gold-600 to-gold-700 rounded-2xl p-12 text-center text-white">
              <h2 className="text-3xl font-bold mb-4">Follow Us</h2>
              <p className="text-gold-100 mb-8 text-lg">Stay in the loop with our latest drops & styles</p>
              <div className="flex justify-center space-x-4">
                {followLinks.map(link => {
                  const isMail = link.key === 'email';
                  return (
                    <a
                      key={link.key}
                      href={link.href}
                      {...(isMail ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
                      aria-label={`${link.label} — ${getSetting('site_name') || 'Hy_stepper'}`}
                      className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors cursor-pointer text-white"
                    >
                      <i className={`${link.icon} text-xl`}></i>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
