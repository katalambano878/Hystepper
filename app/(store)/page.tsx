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
      headline: 'Step Into Elegance',
      subheadline: 'Discover premium footwear crafted for the modern trendsetter. From stunning heels to everyday essentials — walk with confidence.',
      primaryButtonText: 'Shop Now',
      primaryButtonLink: '/shop',
      secondaryButtonText: 'New Arrivals',
      secondaryButtonLink: '/shop?sort=new',
      backgroundImage: '/hero-footwear.png'
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
            count: 'Explore Collection',
            slug: c.slug
          })));
        } else {
          // Fallback for demo if no categories in DB yet
          setCategories([
            { name: 'Heels', image: '/hero-footwear.png', count: 'Shop Heels', slug: 'heels' },
            { name: 'Flats', image: '/hero-footwear.png', count: 'Shop Flats', slug: 'flats' },
            { name: 'Sandals', image: '/hero-footwear.png', count: 'Shop Sandals', slug: 'sandals' },
            { name: 'Boots', image: '/hero-footwear.png', count: 'Shop Boots', slug: 'boots' }
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

  return (
    <main className="min-h-screen bg-white">

      {/* Hero Section - Premium Footwear */}
      <section className="relative min-h-[90vh] lg:min-h-screen overflow-hidden">

        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950 via-emerald-900 to-slate-900"></div>

        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 -left-32 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-800/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 lg:pt-32 lg:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[70vh]">

            {/* Content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <div className="inline-flex items-center gap-3 mb-6">
                <span className="h-px w-12 bg-emerald-400"></span>
                <span className="text-emerald-400 text-sm font-semibold tracking-[0.2em] uppercase">New Collection 2026</span>
              </div>

              <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl xl:text-8xl text-white leading-[1.1] mb-6">
                {config.hero.headline}
              </h1>

              <p className="text-lg lg:text-xl text-emerald-100/80 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-10">
                {config.hero.subheadline}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href={config.hero.primaryButtonLink}
                  className="group inline-flex items-center justify-center gap-3 bg-white text-emerald-900 hover:bg-emerald-50 px-8 py-4 rounded-full font-semibold text-lg transition-all shadow-2xl hover:shadow-emerald-500/25 hover:-translate-y-1"
                >
                  {config.hero.primaryButtonText}
                  <i className="ri-arrow-right-line group-hover:translate-x-1 transition-transform"></i>
                </Link>
                <Link
                  href={config.hero.secondaryButtonLink}
                  className="inline-flex items-center justify-center gap-2 border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 px-8 py-4 rounded-full font-semibold text-lg transition-all"
                >
                  <i className="ri-sparkling-line"></i>
                  {config.hero.secondaryButtonText}
                </Link>
              </div>

              {/* Trust Badges */}
              <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-3 gap-6">
                <div className="text-center lg:text-left">
                  <p className="text-2xl lg:text-3xl font-bold text-white mb-1">500+</p>
                  <p className="text-sm text-emerald-200/60">Happy Customers</p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-2xl lg:text-3xl font-bold text-white mb-1">100%</p>
                  <p className="text-sm text-emerald-200/60">Quality Assured</p>
                </div>
                <div className="text-center lg:text-left">
                  <p className="text-2xl lg:text-3xl font-bold text-white mb-1">24/7</p>
                  <p className="text-sm text-emerald-200/60">Customer Support</p>
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative order-1 lg:order-2 flex justify-center items-center">
              <div className="relative">
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/30 to-transparent rounded-3xl blur-2xl scale-110"></div>

                {/* Main Image */}
                <div className="relative w-full max-w-md lg:max-w-lg xl:max-w-xl mx-auto">
                  <img
                    src={config.hero.backgroundImage}
                    alt="Premium Footwear Collection"
                    className="w-full h-auto object-contain rounded-3xl shadow-2xl transform hover:scale-105 transition-transform duration-700"
                  />
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-4 -left-4 lg:-left-8 bg-white rounded-2xl p-4 lg:p-5 shadow-2xl animate-bounce-slow">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <i className="ri-truck-line text-2xl text-emerald-700"></i>
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-sm lg:text-base">Free Delivery</p>
                      <p className="text-xs text-gray-500">On orders over GH₵200</p>
                    </div>
                  </div>
                </div>

                {/* Another Floating Badge */}
                <div className="absolute -top-4 -right-4 lg:-right-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl p-4 shadow-2xl text-white">
                  <p className="text-xs font-semibold uppercase tracking-wide">Limited</p>
                  <p className="text-xl lg:text-2xl font-bold">25% OFF</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/50">
          <span className="text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white/50 rounded-full animate-bounce"></div>
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
