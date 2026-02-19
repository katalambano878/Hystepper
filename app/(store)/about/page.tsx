'use client';

import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import PageHero from '@/components/PageHero';

export default function AboutPage() {
  const { getSetting } = useCMS();
  const siteName = getSetting('site_name') || 'Hy-Stepper';

  return (
    <div className="min-h-screen bg-white">
      <PageHero
        title={`About Us – ${siteName}`}
        subtitle="Every woman deserves to walk with confidence."
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20">
        <div className="space-y-8 text-gray-700 text-base md:text-lg leading-relaxed">
          <p>
            At <strong className="text-gray-900">{siteName}</strong>, we believe every woman deserves to walk with confidence. Since 2019, we&apos;ve been offering stylish, high-quality footwear and trendy bags at affordable prices. We source exclusive, on-trend pieces that help our customers stay sleek in style without breaking the bank.
          </p>

          <p>
            Our mission is to empower fashion-conscious women by providing them with fashionable, comfortable options that complement their personal style. Whether you&apos;re looking for the perfect pair of high heels or a statement bag, we&apos;ve got you covered. Our products are designed to offer both quality and affordability, making sure you always look great while feeling confident.
          </p>

          <p>
            We cater to women who value style, quality, and comfort in their footwear and accessories, offering a variety of products that are perfect for every occasion.
          </p>

          <p className="text-xl md:text-2xl font-serif font-bold text-gray-900 text-center pt-4">
            Stay Sleek in Style&hellip;
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gray-900 py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6">Ready to find your next pair?</h2>
          <p className="text-gray-400 mb-8 text-lg">
            Browse our latest collection of heels, sandals, and bags.
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-3 bg-gold-500 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-gold-600 transition-colors shadow-lg"
          >
            Shop Now
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
