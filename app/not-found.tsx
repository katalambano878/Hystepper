import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16 bg-gray-50">
      <p className="text-sm font-semibold tracking-[0.2em] uppercase text-gold-600 mb-3">404</p>
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Page not found</h1>
      <p className="text-gray-600 max-w-md mb-8">
        That link doesn&apos;t exist or may have moved. Try one of these instead.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
        >
          Home
        </Link>
        <Link
          href="/shop"
          className="px-5 py-2.5 rounded-lg bg-gold-600 text-white font-semibold hover:bg-gold-700 transition-colors"
        >
          Shop
        </Link>
        <Link
          href="/categories"
          className="px-5 py-2.5 rounded-lg border-2 border-gray-300 text-gray-900 font-semibold hover:bg-white transition-colors"
        >
          Categories
        </Link>
        <Link
          href="/contact"
          className="px-5 py-2.5 rounded-lg border-2 border-gray-300 text-gray-900 font-semibold hover:bg-white transition-colors"
        >
          Contact
        </Link>
      </div>
    </div>
  );
}
