'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { cartCount } = useCart();
  const { wishlistCount } = useWishlist();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="grid grid-cols-5 h-16">
        <Link
          href="/"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${isActive('/') ? 'text-gold-600' : 'text-gray-600'
            }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`${isActive('/') ? 'ri-home-5-fill' : 'ri-home-5-line'} text-xl`}></i>
          </div>
          <span className="text-xs font-medium whitespace-nowrap">Home</span>
        </Link>

        <Link
          href="/shop"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${isActive('/shop') ? 'text-gold-600' : 'text-gray-600'
            }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`${isActive('/shop') ? 'ri-store-3-fill' : 'ri-store-3-line'} text-xl`}></i>
          </div>
          <span className="text-xs font-medium whitespace-nowrap">Shop</span>
        </Link>

        <Link
          href="/cart"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors relative ${isActive('/cart') ? 'text-gold-600' : 'text-gray-600'
            }`}
        >
          <div className="w-6 h-6 flex items-center justify-center relative">
            <i className={`${isActive('/cart') ? 'ri-shopping-cart-fill' : 'ri-shopping-cart-line'} text-xl`}></i>
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium whitespace-nowrap">Cart</span>
        </Link>

        <Link
          href="/wishlist"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors relative ${isActive('/wishlist') ? 'text-gold-600' : 'text-gray-600'
            }`}
        >
          <div className="w-6 h-6 flex items-center justify-center relative">
            <i className={`${isActive('/wishlist') ? 'ri-heart-3-fill' : 'ri-heart-3-line'} text-xl`}></i>
            {wishlistCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {wishlistCount}
              </span>
            )}
          </div>
          <span className="text-xs font-medium whitespace-nowrap">Wishlist</span>
        </Link>

        <Link
          href="/account"
          className={`flex flex-col items-center justify-center space-y-1 transition-colors ${isActive('/account') ? 'text-gold-600' : 'text-gray-600'
            }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <i className={`${isActive('/account') ? 'ri-user-3-fill' : 'ri-user-3-line'} text-xl`}></i>
          </div>
          <span className="text-xs font-medium whitespace-nowrap">Account</span>
        </Link>
      </div>
    </nav>
  );
}
