'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';


export default function HomePage() {

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [discountedProducts, setDiscountedProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const config = {
    hero: {
      headline: 'Stay Sleek in Style',
      subheadline: 'Elevate your look with our exclusive collection of footwear and bags — made for the modern woman.',
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
            id, name, slug, price, compare_at_price, quantity, rating_avg, review_count, featured,
            product_images!product_id(url, position),
            product_variants(option2, option3, image_url, quantity)
          `)
          .eq('status', 'active')
          .not('product_images.url', 'ilike', 'data:video%')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(limit)
          .order('position', { foreignTable: 'product_images', ascending: true })
          .limit(1, { foreignTable: 'product_images' });

        if (productsError) console.error('Error fetching home products:', productsError);

        if (productsData) {
          const formatted = productsData.map(p => {
            const seen = new Set();
            const colors = (p.product_variants || [])
              .filter((v: any) => v.option2)
              .reduce((acc: any[], v: any) => {
                if (!seen.has(v.option2)) { seen.add(v.option2); acc.push({ name: v.option2, hex: v.option3 || null, image: v.image_url || null }); }
                return acc;
              }, []);
            const hasVariantInventory = (p.product_variants || []).length > 0;
            const effectiveStock = hasVariantInventory
              ? (p.product_variants || []).reduce((sum: number, v: any) => sum + (Number(v?.quantity) || 0), 0)
              : (Number(p.quantity) || 0);

            return {
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
              inStock: effectiveStock > 0,
              colors: colors.length > 0 ? colors : undefined
            };
          });
          setFeaturedProducts(formatted);
        }

        // Fetch discounted products
        const { data: discountData, error: discountError } = await supabase
          .from('products')
          .select(`
            id, name, slug, price, compare_at_price, quantity, rating_avg, review_count,
            product_images!product_id(url, position),
            product_variants(option2, option3, image_url, quantity)
          `)
          .eq('status', 'active')
          .not('compare_at_price', 'is', null)
          .gt('compare_at_price', 0)
          .not('product_images.url', 'ilike', 'data:video%')
          .order('created_at', { ascending: false })
          .limit(8)
          .order('position', { foreignTable: 'product_images', ascending: true })
          .limit(1, { foreignTable: 'product_images' });

        if (discountError) console.error('Error fetching discounted products:', discountError);

        if (discountData) {
          const discounted = discountData
            .filter(p => p.compare_at_price > p.price)
            .map(p => {
              const seen = new Set();
              const colors = (p.product_variants || [])
                .filter((v: any) => v.option2)
                .reduce((acc: any[], v: any) => {
                  if (!seen.has(v.option2)) { seen.add(v.option2); acc.push({ name: v.option2, hex: v.option3 || null, image: v.image_url || null }); }
                  return acc;
                }, []);
              const hasVariantInventory = (p.product_variants || []).length > 0;
              const effectiveStock = hasVariantInventory
                ? (p.product_variants || []).reduce((sum: number, v: any) => sum + (Number(v?.quantity) || 0), 0)
                : (Number(p.quantity) || 0);

              return {
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
                inStock: effectiveStock > 0,
                colors: colors.length > 0 ? colors : undefined
              };
            });
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
          {config.hero.backgroundImage.startsWith('data:') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.hero.backgroundImage}
              alt="Hy_stepper Collection"
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <Image
              src={config.hero.backgroundImage}
              alt="Hy_stepper Collection"
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          )}
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

      {/* Shop By — Linear Stacked Design */}
      <section className="relative overflow-hidden">
        
        {/* ROW 1: Heel Height — Full-width linear strip */}
        <div className="bg-gray-900 animate-fade-in-up delay-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center">
              
              {/* Left Label */}
              <div className="py-4 md:py-0 md:pr-10 md:border-r border-white/10 md:w-56 flex-shrink-0">
                <div className="flex items-baseline gap-2 md:block">
                  <span className="text-gold-400 text-xs font-semibold tracking-[0.2em] uppercase md:block md:mb-1">Shop By</span>
                  <h2 className="text-xl md:text-2xl font-serif font-bold text-white">Heel Height</h2>
                </div>
              </div>

              {/* Horizontal Items */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 divide-x divide-white/10">
                {[
                  { label: 'Flat', value: 'flat', range: '0–1"', desc: 'Everyday ease', icon: 'ri-footprint-line' },
                  { label: 'Low', value: 'low', range: '1–2"', desc: 'Subtle lift', icon: 'ri-arrow-right-up-line' },
                  { label: 'Mid', value: 'mid', range: '2–3"', desc: 'Classic versatility', icon: 'ri-sort-asc' },
                  { label: 'High', value: 'high', range: '4"+', desc: 'Bold statement', icon: 'ri-vip-crown-line' },
                ].map((item) => (
                  <Link
                    key={item.value}
                    href={`/shop?heel_height=${item.value}`}
                    className="group relative flex items-center gap-4 px-6 py-8 md:py-10 transition-all duration-300 hover:bg-white/5"
                  >
                    {/* Gold accent line — appears on hover */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gold-500 transform origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"></div>

                    <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-gold-500/20 flex items-center justify-center transition-all duration-300 flex-shrink-0">
                      <i className={`${item.icon} text-lg text-gray-400 group-hover:text-gold-400 transition-colors duration-300`}></i>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <h3 className="text-white font-semibold text-base group-hover:text-gold-400 transition-colors duration-300">{item.label}</h3>
                        <span className="text-[11px] text-gray-500 font-medium">{item.range}</span>
                      </div>
                      <p className="text-gray-500 text-xs group-hover:text-gray-400 transition-colors truncate">{item.desc}</p>
                    </div>

                    <i className="ri-arrow-right-s-line text-gray-600 group-hover:text-gold-400 ml-auto flex-shrink-0 opacity-0 group-hover:opacity-100 transform translate-x-[-8px] group-hover:translate-x-0 transition-all duration-300"></i>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Size — Clean white linear strip */}
        <div className="bg-white border-b border-gray-100 animate-fade-in-up delay-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center">

              {/* Left Label */}
              <div className="py-4 md:py-0 md:pr-10 md:border-r border-gray-100 md:w-56 flex-shrink-0">
                <div className="flex items-baseline gap-2 md:block">
                  <span className="text-gold-600 text-xs font-semibold tracking-[0.2em] uppercase md:block md:mb-1">Shop By</span>
                  <h2 className="text-xl md:text-2xl font-serif font-bold text-gray-900">Size</h2>
                </div>
              </div>

              {/* Horizontal Size Strip */}
              <div className="flex-1 flex items-center py-7 md:py-10 pl-0 md:pl-10 gap-3 overflow-x-auto scrollbar-hide">
                {[37, 38, 39, 40, 41].map((size) => (
                  <Link
                    key={size}
                    href={`/shop?size=${size}`}
                    className="group relative w-16 h-16 md:w-[72px] md:h-[72px] flex-shrink-0 flex items-center justify-center rounded-full border-2 border-gray-200 hover:border-gray-900 hover:bg-gray-900 transition-all duration-300 overflow-hidden"
                  >
                    <span className="text-base font-bold text-gray-800 group-hover:text-white transition-colors duration-300 relative z-10">{size}</span>
                  </Link>
                ))}

                {/* Separator + Size Guide */}
                <div className="h-10 w-px bg-gray-200 flex-shrink-0 mx-2 hidden md:block"></div>
                <Link
                  href="/size-guide"
                  className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-400 hover:text-gold-600 transition-colors group whitespace-nowrap"
                >
                  <i className="ri-ruler-line text-base"></i>
                  <span className="font-medium hidden md:inline group-hover:underline decoration-gold-500 underline-offset-4">Size Guide</span>
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
