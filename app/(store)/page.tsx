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
      <section className="relative h-[70vh] lg:h-[85vh] overflow-hidden">
        {/* Full Background Image */}
        <div className="absolute inset-0">
          <img
            src={config.hero.backgroundImage}
            alt="Hy_stepper Collection"
            className="w-full h-full object-cover object-top"
          />
          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>
        </div>

        {/* Content */}
        <div className="relative h-full flex flex-col items-center justify-end pb-16 lg:pb-24 px-4 text-center">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-7xl text-white leading-tight mb-4 drop-shadow-lg">
            {config.hero.headline}
          </h1>
          <p className="text-lg lg:text-xl text-white/90 max-w-xl mb-8 drop-shadow-md">
            {config.hero.subheadline}
          </p>
          <Link
            href={config.hero.primaryButtonLink}
            className="inline-flex items-center gap-3 bg-gold-500 hover:bg-gold-600 text-white px-10 py-4 rounded-full font-semibold text-lg transition-all shadow-xl hover:shadow-gold-500/30 hover:-translate-y-0.5"
          >
            {config.hero.primaryButtonText}
            <i className="ri-arrow-right-line"></i>
          </Link>
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
                ].map((item) => (
                  <Link
                    key={item.value}
                    href={`/shop?heel_height=${item.value}`}
                    className="group flex flex-col p-6 bg-gray-50 border border-transparent hover:bg-white hover:border-gold-200 rounded-2xl transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-gold-100 rounded-bl-full -mr-8 -mt-8 opacity-0 group-hover:opacity-50 transition-opacity"></div>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <span className="text-gray-400 group-hover:text-gold-600 transition-colors bg-white p-2 rounded-lg shadow-sm group-hover:shadow-md">
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
            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-8">
                <span className="w-12 h-12 rounded-full bg-gold-50 flex items-center justify-center text-gold-600 ring-4 ring-gold-50/50">
                  <i className="ri-layout-grid-fill text-2xl"></i>
                </span>
                <div>
                  <h2 className="text-3xl font-serif font-bold text-gray-900">Shop by Size</h2>
                  <p className="text-gray-500 text-sm">Browse inclusive sizing options</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-3xl p-8 lg:p-10 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold-100/50 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gray-200/50 rounded-full blur-2xl -ml-10 -mb-10"></div>

                <div className="flex flex-wrap gap-3 sm:gap-4 justify-center relative z-10">
                  {[35, 36, 37, 38, 39, 40, 41, 42, 43].map((size) => (
                    <Link
                      key={size}
                      href={`/shop?size=${size}`}
                      className="w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center bg-white border-2 border-transparent hover:border-gold-500 rounded-full text-lg sm:text-xl font-bold text-gray-700 hover:text-gold-600 shadow-sm hover:shadow-lg hover:scale-110 transition-all duration-300"
                    >
                      {size}
                    </Link>
                  ))}
                </div>

                <div className="mt-8 text-center relative z-10">
                  <p className="inline-flex items-center gap-2 text-sm text-gray-500 bg-white px-4 py-2 rounded-full shadow-sm">
                    <i className="ri-ruler-line text-gold-500"></i>
                    <span>True to size fit</span>
                  </p>
                </div>
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
              <div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">{config.sections.newArrivals.title}</h2>
                <p className="text-gray-500">{config.sections.newArrivals.subtitle}</p>
              </div>
              <Link href="/shop" className="hidden sm:inline-flex items-center text-gold-600 hover:text-gold-700 font-semibold whitespace-nowrap cursor-pointer">
                View All
                <i className="ri-arrow-right-line ml-2"></i>
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
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
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
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gold-600 text-white px-8 py-3.5 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                View All Products
                <i className="ri-arrow-right-line"></i>
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
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold-100 text-gold-700 text-sm font-bold rounded-full mb-3">
                  <i className="ri-fire-fill"></i>
                  Hot Deals
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Discounted Items</h2>
                <p className="text-gray-500">Grab these deals before they&apos;re gone</p>
              </div>
              <Link href="/shop?sort=discount" className="hidden sm:inline-flex items-center text-gold-600 hover:text-gold-700 font-semibold whitespace-nowrap cursor-pointer">
                View All Deals
                <i className="ri-arrow-right-line ml-2"></i>
              </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {discountedProducts.map((product) => (
                <ProductCard key={product.id} {...product} />
              ))}
            </div>

            <div className="text-center mt-10 sm:hidden">
              <Link
                href="/shop?sort=discount"
                className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-700 text-white px-8 py-3.5 rounded-full font-medium transition-colors"
              >
                View All Deals
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </div>
        </section>
      )}

    </main>
  );
}
