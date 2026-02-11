'use client';

import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
}

export default function ProductCard({
  id,
  name,
  price,
  originalPrice,
  image,
  rating = 5,
  reviewCount = 0,
  badge,
  inStock = true
}: ProductCardProps) {
  const { addToCart } = useCart();
  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;

  return (
    <div className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full flex flex-col">
      <Link href={`/product/${id}`} className="relative block aspect-square overflow-hidden bg-gray-100 flex-shrink-0">
        <LazyImage
          src={image}
          alt={name}
          className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500"
        />
        {badge && (
          <span className="absolute top-3 left-3 bg-gold-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            {badge}
          </span>
        )}
        {discount > 0 && (
          <span className="absolute top-3 right-3 bg-red-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
            -{discount}%
          </span>
        )}
        {!inStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-gray-700 font-semibold text-lg">Out of Stock</span>
          </div>
        )}
      </Link>

      <div className="p-4 flex flex-col flex-grow">
        <Link href={`/product/${id}`}>
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-gold-600 transition-colors h-12 lg:h-auto">
            {name}
          </h3>
        </Link>

        <div className="flex items-center justify-between mt-auto mb-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg lg:text-xl font-bold text-gray-900">GH₵{price.toFixed(2)}</span>
            {originalPrice && (
              <span className="text-xs lg:text-sm text-gray-400 line-through">GH₵{originalPrice.toFixed(2)}</span>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            // Assuming default maxStock of 10 if not provided, since inStock is true
            addToCart({
              id,
              name,
              price,
              image,
              quantity: 1,
              slug: id,
              maxStock: 50
            });
          }}
          className="w-full bg-gray-900 hover:bg-gold-600 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 whitespace-nowrap text-sm lg:text-base cursor-pointer"
          disabled={!inStock}
        >
          <i className="ri-shopping-cart-line text-lg"></i>
          <span>{inStock ? 'Add to Cart' : 'Out of Stock'}</span>
        </button>
      </div>
    </div>
  );
}