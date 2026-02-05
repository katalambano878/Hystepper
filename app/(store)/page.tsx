'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import ProductCard from '@/components/ProductCard';


export default function HomePage() {

  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]); // Dynamic Categories
  const [loading, setLoading] = useState(true);

  // Config State - Managed in Code
  const config = {
    hero: {
      headline: 'Mannequins, Kitchen Essentials, Electronics & Dresses — All In One Store',
      subheadline: 'Hy_stepper brings you sourced products with verified quality and unbeatable pricing perfect for homes, small businesses, and resellers.',
      primaryButtonText: 'Shop Collections',
      primaryButtonLink: '/shop',
      secondaryButtonText: 'Our Story',
      secondaryButtonLink: '/about',
      backgroundImage: '/sarah-lawson.jpeg'
    },
    sections: {
      newArrivals: {
        enabled: true,
        title: 'Featured Products',
        subtitle: 'Handpicked for you',
        count: 8
      }
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // 1. Fetch featured or newest products
        const limit = 8;


        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select(`
            *,
            product_images!product_id(url, position, alt_text)
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(limit)
          .order('position', { foreignTable: 'product_images', ascending: true });

        if (productsError) console.error('Error fetching home products:', productsError);

        if (productsData) {
          const formatted = productsData.map(p => ({
            id: p.id,
            name: p.name,
            price: p.price,
            originalPrice: p.compare_at_price,
            image: p.product_images?.find((img: any) => img.position === 0)?.url
              || p.product_images?.[0]?.url
              || 'https://via.placeholder.com/800x800?text=No+Image',
            rating: p.rating_avg || 0,
            reviewCount: p.review_count || 0,
            slug: p.slug
          }));
          setFeaturedProducts(formatted);
        }

        // 2. Fetch Categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name, slug, image_url, metadata')
          .eq('status', 'active')
          .limit(4);

        if (categoriesError) console.error('Error fetching categories:', categoriesError);

        if (categoriesData && categoriesData.length > 0) {
          setCategories(categoriesData.map(c => ({
            id: c.id,
            name: c.name,
            image: c.image_url || 'https://via.placeholder.com/600',
            count: 'Explore Collection', // We could do a count query but expensive
            slug: c.slug
          })));
        } else {
          // Fallback for demo if no categories in DB yet
          setCategories([
            { name: 'Home & Living', image: 'https://readdy.ai/api/search-image?query=elegant%20home%20living%20room%20setup%20with%20modern%20furniture%20cozy%20atmosphere%20natural%20materials%20cream%20and%20green%20tones%20premium%20interior%20design%20sophisticated%20lifestyle%20photography&width=600&height=600&seq=cat1&orientation=squarish', count: '120+ Items', slug: 'home-living' },
            { name: 'Fashion & Accessories', image: 'https://readdy.ai/api/search-image?query=luxury%20fashion%20accessories%20leather%20bags%20scarves%20elegant%20arrangement%20on%20clean%20background%20premium%20quality%20sophisticated%20styling%20modern%20aesthetic%20product%20photography&width=600&height=600&seq=cat2&orientation=squarish', count: '85+ Items', slug: 'fashion' },
            { name: 'Kitchen & Dining', image: 'https://readdy.ai/api/search-image?query=premium%20kitchen%20dining%20tableware%20ceramic%20plates%20wooden%20boards%20elegant%20table%20setting%20natural%20materials%20sophisticated%20home%20goods%20lifestyle%20photography&width=600&height=600&seq=cat3&orientation=squarish', count: '95+ Items', slug: 'kitchen' },
            { name: 'Gifts & Decor', image: 'https://readdy.ai/api/search-image?query=curated%20gift%20collection%20decorative%20items%20vases%20candles%20elegant%20presentation%20premium%20quality%20sophisticated%20styling%20modern%20aesthetic%20lifestyle%20photography&width=600&height=600&seq=cat4&orientation=squarish', count: '110+ Items', slug: 'gifts' }
          ]);
        }

      } catch (err) {
        console.error('Unexpected error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);



  const getHeroImage = () => {
    if (config.hero.backgroundImage) return config.hero.backgroundImage;
    return "https://readdy.ai/api/search-image?query=elegant%20minimalist%20lifestyle%20flat%20lay%20composition%20featuring%20premium%20home%20decor%20items%20leather%20bag%20ceramic%20vases%20natural%20textiles%20on%20cream%20background%20with%20beautiful%20shadows%20sophisticated%20styling%20luxury%20product%20photography&width=1200&height=1400&seq=hero1&orientation=portrait";
  };

  // Render Banners
  const renderBanners = () => {
    if (!config.banners || config.banners.length === 0) return null;
    return config.banners
      .filter((b: any) => b.active)
      .map((banner: any, i: number) => (
        <div key={i} className="bg-emerald-900 text-white text-center py-2 px-4 text-sm font-medium">
          {banner.text}
        </div>
      ));
  };


  return (
    <main className="min-h-screen bg-white">

      {/* Dynamic Banners (Top) - Optional placement */}
      {renderBanners()}

      {/* Hero Section */}
      {/* Hero Section */}
      <section className="relative w-full overflow-hidden lg:bg-gradient-to-b lg:from-stone-50 lg:via-white lg:to-cream-50">

        {/* Mobile: Full Background Image with Gradient Overlay */}
        <div className="absolute inset-0 lg:hidden z-0">
          <img
            src={getHeroImage()}
            className="w-full h-full object-cover transition-opacity duration-1000"
            alt="Hero Background"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10"></div>
        </div>

        {/* Desktop Blobs */}
        <div className="hidden lg:block absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-20 -right-20 w-96 h-96 bg-emerald-100/50 rounded-full blur-3xl"></div>
          <div className="absolute top-40 -left-20 w-72 h-72 bg-amber-50 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 h-[85vh] lg:h-auto lg:py-24 flex flex-col justify-end lg:block pb-16 lg:pb-0">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">

            {/* Desktop: Image Layout (Hidden on Mobile) */}
            <div className="hidden lg:block order-last relative">
              <div className="relative aspect-[3/4] lg:aspect-auto lg:h-[650px] overflow-hidden rounded-[2rem] shadow-xl">
                <img
                  src={getHeroImage()}
                  alt="Hero Image"
                  className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-1000"
                />

                {/* Floating Badge (Desktop Only) */}
                <div className="absolute bottom-10 left-10 bg-white/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl max-w-xs z-20 border border-white/50">
                  <p className="font-serif text-emerald-800 text-lg italic mb-1">Exclusive Offer</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">25% Off</p>
                  <p className="text-sm text-gray-600 font-medium">On your first dedicated order</p>
                </div>
              </div>
            </div>

            {/* Content Column - Adapts color for Mobile (White) vs Desktop (Dark) */}
            <div className="relative z-10 text-center lg:text-left transition-colors duration-300">

              <div className="inline-flex items-center space-x-2 mb-4 lg:mb-6 justify-center lg:justify-start">
                <span className="h-px w-8 bg-white/70 lg:bg-emerald-800"></span>
                <span className="text-white lg:text-emerald-800 text-sm font-semibold tracking-widest uppercase drop-shadow-sm lg:drop-shadow-none">
                  New Collection
                </span>
                <span className="h-px w-8 bg-white/70 lg:hidden"></span>
              </div>

              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl text-white lg:text-gray-900 leading-[1.05] mb-6 drop-shadow-lg lg:drop-shadow-none">
                {config.hero.headline}
              </h1>

              <p className="text-lg text-white/90 lg:text-gray-600 leading-relaxed max-w-lg mx-auto lg:mx-0 font-light mb-8 lg:mb-10 drop-shadow-md lg:drop-shadow-none">
                {config.hero.subheadline}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start px-4 lg:px-0">
                <Link href={config.hero.primaryButtonLink || '/shop'} className="inline-flex items-center justify-center bg-white lg:bg-gray-900 text-gray-900 lg:text-white hover:bg-emerald-50 lg:hover:bg-emerald-800 px-10 py-4 rounded-full font-medium transition-all text-lg shadow-xl hover:shadow-2xl hover:-translate-y-1">
                  {config.hero.primaryButtonText}
                </Link>
                {config.hero.secondaryButtonText && (
                  <Link href={config.hero.secondaryButtonLink || '/shop'} className="inline-flex items-center justify-center bg-white/20 backdrop-blur-md border border-white/50 lg:bg-white lg:border-gray-200 text-white lg:text-gray-900 hover:bg-white/30 lg:hover:text-emerald-800 lg:hover:border-emerald-800 px-10 py-4 rounded-full font-medium transition-colors text-lg">
                    {config.hero.secondaryButtonText}
                  </Link>
                )}
              </div>

              {/* Stats - Visible on Desktop, Hidden on Mobile Hero */}
              <div className="mt-12 pt-8 border-t border-gray-200 hidden lg:grid grid-cols-3 gap-6">
                <div className="flex flex-col items-start text-left">
                  <p className="font-serif font-bold text-gray-900 text-lg">Direct Import</p>
                  <p className="text-sm text-gray-500">Sourced from China</p>
                </div>
                <div className="flex flex-col items-start text-left">
                  <p className="font-serif font-bold text-gray-900 text-lg">Verified Quality</p>
                  <p className="text-sm text-gray-500">Inspected by hand</p>
                </div>
                <div className="flex flex-col items-start text-left">
                  <p className="font-serif font-bold text-gray-900 text-lg">Best Prices</p>
                  <p className="text-sm text-gray-500">Unbeatable value</p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-12">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">Shop by Category</h2>
              <p className="text-lg text-gray-600 max-w-2xl">Explore our carefully curated collections</p>
            </div>
            <Link href="/categories" className="hidden sm:inline-flex items-center text-emerald-700 hover:text-emerald-900 font-semibold whitespace-nowrap cursor-pointer">
              View All
              <i className="ri-arrow-right-line ml-2"></i>
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <Link
                key={index}
                href={`/shop?category=${category.slug}`}
                className="group relative aspect-square rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-shadow cursor-pointer"
              >
                <img
                  src={category.image}
                  alt={category.name}
                  className="w-full h-full object-cover object-top group-hover:scale-110 transition-transform duration-500"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'https://via.placeholder.com/600?text=' + encodeURIComponent(category.name);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h3 className="text-xl font-bold mb-1">{category.name}</h3>
                  <p className="text-sm text-white/90">{category.count}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center sm:hidden">
            <Link href="/categories" className="inline-flex items-center justify-center w-full px-6 py-3 border-2 border-gray-200 rounded-lg text-gray-900 font-semibold hover:border-emerald-700 hover:text-emerald-700 transition-colors">
              View All Categories
            </Link>
          </div>
        </div>
      </section>

      {/* New Arrivals / Best Sellers Section */}
      {config.sections?.newArrivals?.enabled && (
        <section className="py-20 bg-gray-50" data-product-shop>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-end justify-between mb-12">
              <div>
                <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">{config.sections.newArrivals.title}</h2>
                <p className="text-lg text-gray-600">{config.sections.newArrivals.subtitle}</p>
              </div>
              <Link href="/shop" className="hidden sm:inline-flex items-center text-emerald-700 hover:text-emerald-900 font-semibold whitespace-nowrap cursor-pointer">
                View All
                <i className="ri-arrow-right-line ml-2"></i>
              </Link>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} {...product} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No products found. Start adding products from the Admin Dashboard!</p>
              </div>
            )}

            <div className="text-center mt-12">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                View All Products
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="py-12 lg:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-8">
            {[
              { icon: 'ri-store-2-line', title: 'Free Store Pickup', description: 'Pick up at our store' },
              { icon: 'ri-arrow-left-right-line', title: 'Easy Returns', description: '30-day return policy' },
              { icon: 'ri-customer-service-2-line', title: '24/7 Support', description: 'Dedicated service' },
              { icon: 'ri-shield-check-line', title: 'Secure Payment', description: 'Safe checkout' }
            ].map((item, index) => (
              <div key={index} className="text-center p-4 rounded-lg bg-gray-50 lg:bg-transparent">
                <div className="w-12 h-12 lg:w-16 lg:h-16 flex items-center justify-center mx-auto mb-3 bg-emerald-100 rounded-full">
                  <i className={`${item.icon} text-2xl lg:text-3xl text-emerald-700`}></i>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 text-sm lg:text-base">{item.title}</h3>
                <p className="text-xs lg:text-sm text-gray-600 leading-tight">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>


    </main>
  );
}
