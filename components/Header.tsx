'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import MiniCart from './MiniCart';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { useCMS } from '@/context/CMSContext';
import AnnouncementBar from './AnnouncementBar';

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wishlistCount, setWishlistCount] = useState(0);
  const [user, setUser] = useState<any>(null);

  const { cartCount, isCartOpen, setIsCartOpen } = useCart();
  const { getSetting } = useCMS();

  const siteName = getSetting('site_name') || 'Hy_stepper';

  useEffect(() => {
    // Wishlist logic
    const updateWishlistCount = () => {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      setWishlistCount(wishlist.length);
    };

    updateWishlistCount();
    window.addEventListener('wishlistUpdated', updateWishlistCount);

    // Auth logic
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      window.removeEventListener('wishlistUpdated', updateWishlistCount);
      subscription.unsubscribe();
    };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      <AnnouncementBar />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <nav aria-label="Main navigation">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  className="lg:hidden p-1 -ml-1 text-gray-700 hover:text-emerald-700 transition-colors"
                  onClick={() => setIsMobileMenuOpen(true)}
                  aria-label="Open menu"
                >
                  <i className="ri-menu-line text-2xl"></i>
                </button>
                <Link
                  href="/"
                  className="flex items-center"
                  aria-label="Go to homepage"
                >
                  <img src="/sarahlogo.png" alt={siteName} className="h-8 md:h-10 w-auto object-contain" />
                </Link>
              </div>

              <div className="hidden lg:flex items-center space-x-8">
                <Link
                  href="/shop"
                  className="text-gray-700 hover:text-emerald-700 font-medium transition-colors whitespace-nowrap"
                  aria-label="Shop all products"
                >
                  Shop
                </Link>
                <Link
                  href="/categories"
                  className="text-gray-700 hover:text-emerald-700 font-medium transition-colors whitespace-nowrap"
                  aria-label="Browse categories"
                >
                  Categories
                </Link>
                <Link
                  href="/about"
                  className="text-gray-700 hover:text-emerald-700 font-medium transition-colors whitespace-nowrap"
                  aria-label="Learn about us"
                >
                  About
                </Link>
                <Link
                  href="/contact"
                  className="text-gray-700 hover:text-emerald-700 font-medium transition-colors whitespace-nowrap"
                  aria-label="Contact us"
                >
                  Contact
                </Link>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-emerald-700 transition-colors lg:hidden"
                  onClick={() => setIsSearchOpen(true)}
                  aria-label="Open search"
                >
                  <i className="ri-search-line text-2xl"></i>
                </button>

                <div className="hidden lg:block relative">
                  <input
                    type="search"
                    placeholder="Search products..."
                    className="w-80 pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-sm"
                    aria-label="Search products"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
                  />
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg"></i>
                </div>

                <Link
                  href="/wishlist"
                  className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-emerald-700 transition-colors relative"
                  aria-label={`Wishlist, ${wishlistCount} items`}
                >
                  <i className="ri-heart-line text-2xl"></i>
                  {wishlistCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-700 text-white text-xs rounded-full flex items-center justify-center" aria-hidden="true">
                      {wishlistCount}
                    </span>
                  )}
                </Link>

                <div className="relative">
                  <button
                    className="w-10 h-10 flex items-center justify-center text-gray-700 hover:text-emerald-700 transition-colors relative"
                    onClick={() => setIsCartOpen(!isCartOpen)}
                    aria-label={`Shopping cart, ${cartCount} items`}
                    aria-expanded={isCartOpen}
                    aria-controls="mini-cart"
                  >
                    <i className="ri-shopping-cart-line text-2xl"></i>
                    {cartCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-700 text-white text-xs rounded-full flex items-center justify-center" aria-hidden="true">
                        {cartCount}
                      </span>
                    )}
                  </button>

                  <MiniCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
                </div>

                {user ? (
                  <Link
                    href="/account"
                    className="hidden lg:flex w-10 h-10 items-center justify-center text-emerald-700 hover:text-emerald-900 transition-colors bg-emerald-50 rounded-full"
                    aria-label="My account"
                    title="Account"
                  >
                    <i className="ri-user-fill text-2xl"></i>
                  </Link>
                ) : (
                  <Link
                    href="/auth/login"
                    className="hidden lg:flex w-10 h-10 items-center justify-center text-gray-700 hover:text-emerald-700 transition-colors"
                    aria-label="Login"
                    title="Login"
                  >
                    <i className="ri-user-line text-2xl"></i>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </nav>
      </header >

      {isSearchOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-24">
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 shadow-2xl">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900">Search Products</h3>
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700"
                >
                  <i className="ri-close-line text-2xl"></i>
                </button>
              </div>
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search for products..."
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-emerald-700 hover:text-emerald-900"
                  >
                    <i className="ri-search-line text-xl"></i>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )
      }

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-0 left-0 bottom-0 w-4/5 max-w-xs bg-white shadow-xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <img src="/sarahlogo.png" alt={siteName} className="h-8 w-auto object-contain" />
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 -mr-2 text-gray-500 hover:text-gray-900"
                aria-label="Close menu"
              >
                <i className="ri-close-line text-2xl"></i>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {[
                { label: 'Home', href: '/' },
                { label: 'Shop', href: '/shop' },
                { label: 'Categories', href: '/categories' },
                { label: 'About', href: '/about' },
                { label: 'Contact', href: '/contact' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-lg font-medium text-gray-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="h-px bg-gray-100 my-2"></div>
              {[
                { label: 'Track Order', href: '/order-tracking' },
                { label: 'Wishlist', href: '/wishlist' },
                { label: 'My Account', href: '/account' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                &copy; {new Date().getFullYear()} {siteName}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}