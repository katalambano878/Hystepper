'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';


export default function HomePage() {

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [discountedProducts, setDiscountedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const config = {
    hero: {
      headline: 'Step Into Elegance',
      subheadline: 'Premium footwear crafted for the modern trendsetter.',
      primaryButtonText: 'Shop Now',
      primaryButtonLink: '/shop',
      backgroundImage: '/hero-new.jpeg'
    },
    sections: {
      newArrivals: {
        enabled: true,
        title: 'Trending Now',
        subtitle: 'Our most loved styles this season',
        count: 8
      }
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const limit = 8;

        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            *,
            product_images!product_id(url, position, alt_text)
          `)
          .eq('status', 'active')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit)
          .order('position', { foreignTable: 'product_images', ascending: true });

        if (productsError) console.error('Error fetching home products:', productsError);

        if (productsData) {
          const formatted = productsData.map(p => ({
            id: p.slug,
            name: p.name,
            price: p.price,
            originalPrice: p.compare_at_price,
            image: p.product_images?.find((img: any) => img.position === 0)?.url
              || p.product_images?.[0]?.url
              || 'https://via.placeholder.com/800x800?text=No+Image',
            rating: p.rating_avg || 0,
            reviewCount: p.review_count || 0,
            slug: p.slug,
            inStock: p.quantity > 0
          }));
          setFeaturedProducts(formatted);
        }

        // Fetch discounted products
        const { data: discountData, error: discountError } = await supabase
          .from('products')
          .select(`
            *,
            product_images!product_id(url, position, alt_text)
          `)
          .eq('status', 'active')
          .not('compare_at_price', 'is', null)
          .gt('compare_at_price', 0)
          .order('created_at', { ascending: false })
          .limit(8)
          .order('position', { foreignTable: 'product_images', ascending: true });

        if (discountError) console.error('Error fetching discounted products:', discountError);

        if (discountData) {
          const discounted = discountData
            .filter(p => p.compare_at_price > p.price)
            .map(p => ({
              id: p.slug,
              name: p.name,
              price: p.price,
              originalPrice: p.compare_at_price,
              image: p.product_images?.find((img: any) => img.position === 0)?.url
                || p.product_images?.[0]?.url
                || 'https://via.placeholder.com/800x800?text=No+Image',
              rating: p.rating_avg || 0,
              reviewCount: p.review_count || 0,
              slug: p.slug,
              badge: 'Sale',
              inStock: p.quantity > 0
            }));
          setDiscountedProducts(discounted);
        }

      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-white">

      {/* Hero Section — Clean & Elegant */}
      <section className="relative h-[70vh] lg:h-[85vh] overflow-hidden group">
        {/* Full Background Image */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            src={config.hero.backgroundImage}
            alt="Hy_stepper Collection"
            className="w-full h-full object-cover object-top animate-zoom-in"
          />
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-end pb-16 lg:pb-24 px-4 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-white leading-tight mb-4 drop-shadow-lg animate-fade-in-up">
            {config.hero.headline}
          </h1>
          <p className="text-lg lg:text-xl text-white/90 max-w-xl mb-8 drop-shadow-md animate-fade-in-up delay-100">
            {config.hero.subheadline}
          </p>
          <div className="animate-fade-in-up delay-200">
            <Link
              href={config.hero.primaryButtonLink}
              className="group inline-flex items-center gap-3 bg-gold-500 hover:bg-gold-600 text-white px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-xl hover:shadow-gold-500/50 hover:-translate-y-1 active:scale-95"
            >
              {config.hero.primaryButtonText}
              <i className="ri-arrow-right-line transition-transform duration-300 group-hover:translate-x-1"></i>
            </Link>
          </div>
        </div>
      </section>

      {/* Quick Filters: Shop by Heel Height & Size */}
      <section className="py-20 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20">

            {/* Heel Height */}
            <div>
              <div className="flex items-center gap-4 mb-8">
                <span className="w-12 h-12 rounded-full bg-gold-50 flex items-center justify-center text-gold-600 ring-4 ring-gold-50/50">
                  <i className="ri-ruler-2-line text-2xl"></i>
                </span>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-gray-900">Heel Height</h2>
                  <p className="text-gray-500 text-sm">Find your perfect elevation</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Flat', value: 'flat', range: '0-1"', desc: 'Everyday Ease', icon: 'ri-footprint-line' },
                  { label: 'Low', value: 'low', range: '1-2"', desc: 'Subtle Lift', icon: 'ri-arrow-right-up-line' },
                  { label: 'Mid', value: 'mid', range: '2-3"', desc: 'Versatile Style', icon: 'ri-sort-asc' },
                  { label: 'High', value: 'high', range: '3"+', desc: 'Statement Maker', icon: 'ri-vip-crown-line' },
                ].map((item, idx) => (
                  <Link
                    key={item.value}
                    href={`/shop?heel_height=${item.value}`}
                    className="group flex flex-col p-6 bg-gray-50 border border-transparent hover:bg-white hover:border-gold-200 rounded-2xl transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 overflow-hidden relative"
                    style={{ animationDelay: `${idx * 100}ms` }}
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-gold-100 rounded-bl-full -mr-10 -mt-10 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-out transform group-hover:scale-110"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <span className="text-gray-400 group-hover:text-gold-600 transition-all duration-300 bg-white p-2 rounded-lg shadow-sm group-hover:shadow-md group-hover:rotate-12">
                        <i className={`${item.icon} text-xl`}></i>
                      </span>
                      <span className="text-xs font-bold px-2 py-1 bg-white border border-gray-100 group-hover:border-gold-200 text-gray-400 group-hover:text-gold-700 rounded-md transition-colors">
                        {item.range}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-900 mb-1 relative z-10">{item.label}</h3>
                    <p className="text-xs text-gray-500 group-hover:text-gray-600 relative z-10">{item.desc}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Sizes */}
            <div className="flex flex-col justify-center h-full">
              <div className="flex items-center gap-4 mb-8">
                <span className="w-12 h-12 rounded-full bg-gold-50 flex items-center justify-center text-gold-600 ring-4 ring-gold-50/50">
                  <i className="ri-layout-grid-fill text-2xl"></i>
                </span>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-gray-900">Shop by Size</h2>
                  <p className="text-gray-500 text-sm">Browse inclusive sizing options</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 pt-4">
                {[35, 36, 37, 38, 39, 40, 41, 42, 43].map((size, idx) => (
                  <Link
                    key={size}
                    href={`/shop?size=${size}`}
                    className="w-24 h-24 flex flex-col items-center justify-center bg-gray-50 hover:bg-white border border-transparent hover:border-gold-200 rounded-2xl transition-all duration-300 transform hover:scale-110 hover:shadow-lg group shadow-sm"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <span className="text-2xl font-bold font-serif text-gray-900 group-hover:text-gold-600 transition-colors">{size}</span>
                    <span className="text-[10px] uppercase tracking-wider text-gray-400 group-hover:text-gold-400 font-medium">EU</span>
                  </Link>
                ))}
              </div>

              <div className="mt-10">
                <Link href="/size-guide" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gold-600 transition-colors group">
                  <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-gold-50 flex items-center justify-center transition-colors group-hover:scale-110 duration-300">
                    <i className="ri-ruler-line text-gray-500 group-hover:text-gold-600"></i>
                  </span>
                  <span className="font-medium group-hover:translate-x-1 transition-transform">True to size fit</span>
                </Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Products Section */}
      {config.sections?.newArrivals?.enabled && (
        <section className="py-16 lg:py-20 bg-gray-50" data-product-shop>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-10">
              <div className="animate-fade-in-up">
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{config.sections.newArrivals.title}</h2>
                <p className="text-gray-500">{config.sections.newArrivals.subtitle}</p>
              </div>
              <Link href="/shop" className="hidden sm:inline-flex items-center text-gold-600 hover:text-gold-700 font-semibold whitespace-nowrap cursor-pointer group transition-all">
                View All
                <i className="ri-arrow-right-line ml-2 transform group-hover:translate-x-1 transition-transform"></i>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {[1, 2, 3, 4].map(idx => (
                  <div key={idx} className="bg-white rounded-xl overflow-hidden shadow-sm h-96 animate-pulse">
                    <div className="h-64 bg-gray-200"></div>
                    <div className="p-4 space-y-3">
                      <div className="h-4 bg-gray-200 w-3/4"></div>
                      <div className="h-4 bg-gray-200 w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                {featuredProducts.map((product, idx) => (
                  <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                    <ProductCard {...product} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No products found. Start adding products from the Admin Dashboard!</p>
              </div>
            )}

            <div className="text-center mt-10">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gold-600 text-white px-8 py-3.5 rounded-full font-medium transition-all hover:shadow-lg hover:-translate-y-1 whitespace-nowrap cursor-pointer group"
              >
                View All Products
                <i className="ri-arrow-right-line transform group-hover:translate-x-1 transition-transform"></i>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Discounted Items */}
      {discountedProducts.length > 0 && (
        <section className="py-16 lg:py-20 bg-gradient-to-br from-gold-50 to-amber-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-10">
              <div className="animate-fade-in-up">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-100 text-gold-700 text-sm font-bold rounded-full mb-3 animate-pulse">
                  <i className="ri-fire-fill"></i>
                  Hot Deals
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Discounted Items</h2>
                <p className="text-gray-500">Grab these deals before they&apos;re gone</p>
              </div>
              <Link href="/shop?sort=discount" className="hidden sm:inline-flex items-center text-gold-600 hover:text-gold-700 font-semibold whitespace-nowrap cursor-pointer group transition-all">
                View All Deals
                <i className="ri-arrow-right-line ml-2 transform group-hover:translate-x-1 transition-transform"></i>
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {discountedProducts.map((product, idx) => (
                <div key={product.id} className="animate-fade-in-up" style={{ animationDelay: `${idx * 100}ms` }}>
                  <ProductCard {...product} />
                </div>
              ))}
            </div>

            <div className="text-center mt-10 sm:hidden">
              <Link
                href="/shop?sort=discount"
                className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-700 text-white px-8 py-3.5 rounded-full font-medium transition-all hover:shadow-lg hover:-translate-y-1 group"
              >
                View All Deals
                <i className="ri-arrow-right-line transform group-hover:translate-x-1 transition-transform"></i>
              </Link>
            </div>
          </div>
        </section>
      )}

    </main>
  );
}
