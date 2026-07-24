import Link from 'next/link';

export default function SizeGuidePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Size Guide</h1>
            <p className="text-xl text-gray-600">
              Find your perfect fit with our comprehensive size guide. Accurate sizing means fewer exchanges!
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        {/* Fit Guide */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Fit Guide</h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            Please refer to the sizing recommendation in each product description before placing your order, as sizing may vary from one style to another.
          </p>

          <div className="space-y-4">
            <div className="p-6 bg-white rounded-xl border-2 border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">True to Size / Regular Size / Normal Size</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                This means the shoe fits according to standard sizing. We recommend ordering your usual shoe size.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border-2 border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">Runs Small / Closed Size</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                This means the shoe fits smaller or snugger than standard sizing. If your usual size is 38, you may need to order 39 for a more comfortable fit.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                If you normally wear a larger size in closed shoes (for example, 37 in open styles and 38 in closed styles), please order your usual closed-shoe size.
              </p>
            </div>

            <div className="p-6 bg-white rounded-xl border-2 border-gray-100">
              <h3 className="font-bold text-gray-900 mb-2">Runs Big / Open Size</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                This means the shoe fits larger or roomier than standard sizing. If your usual size is 38, you may prefer 37 for a better fit.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                If you normally wear a smaller size in open shoes (for example, 38 in closed styles and 37 in open styles), please order your usual open-shoe size.
              </p>
            </div>
          </div>
        </section>

        {/* Foot Shape Guide */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Foot Shape Guide</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-white rounded-xl border-2 border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <i className="ri-arrow-left-right-line text-xl text-emerald-700"></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Wide Feet</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Wide feet are broader than average, especially around the toes or the widest part of the foot. If shoes often feel tight at the sides or your toes feel squeezed, you may have wide feet.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl border-2 border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <i className="ri-subtract-line text-xl text-emerald-700"></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Narrow Feet</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Narrow feet are slimmer than average. If most shoes feel loose around the sides or your feet slide around easily, you may have narrow feet.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl border-2 border-gray-100">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <i className="ri-footprint-line text-xl text-emerald-700"></i>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Fuller Feet</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Fuller Feet have more volume across the top or front of the foot. If shoes often feel tight over the top of your foot, even when the length is correct, you may have fuller feet.
              </p>
            </div>
          </div>
        </section>

        {/* Heel Height Guide — do not change */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Heel Height Guide</h2>
          <p className="text-gray-600 text-center mb-8">Understanding heel heights helps you choose the right shoe for the occasion</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { height: 'Flat (0-1")', comfort: 'Maximum comfort', best: 'Daily wear, walking', icon: '👟' },
              { height: 'Low (2-2.5")', comfort: 'Very comfortable', best: 'Work, casual outings', icon: '👢' },
              { height: 'Mid (3-3.5")', comfort: 'Moderate comfort', best: 'Events, dinners', icon: '👠' },
              { height: 'High (4"+)', comfort: 'Statement piece', best: 'Special occasions', icon: '💃' },
            ].map((item) => (
              <div key={item.height} className="p-6 bg-white rounded-xl border-2 border-gray-100 hover:border-emerald-200 transition-colors text-center">
                <span className="text-4xl mb-4 block">{item.icon}</span>
                <h3 className="font-bold text-gray-900 mb-2">{item.height}</h3>
                <p className="text-sm text-emerald-700 font-medium mb-1">{item.comfort}</p>
                <p className="text-xs text-gray-500">Best for: {item.best}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sizing Exchange Policy */}
        <section className="mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <i className="ri-error-warning-line text-amber-600 text-xl mt-0.5"></i>
              <div>
                <h3 className="font-bold text-amber-900 mb-2">Sizing Exchange Policy</h3>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Exchanges for sizing issues are accepted within 24 hours of delivery. Customers are responsible for the delivery fees when exchanging a size they personally selected. Items must be returned unused and in their original condition.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <p className="text-gray-600 mb-4">Still unsure about your size?</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/shop" className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-800 transition-colors">
              <i className="ri-shopping-bag-line"></i>
              Shop Now
            </Link>
            <Link href="/contact" className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:border-emerald-700 hover:text-emerald-700 transition-colors">
              <i className="ri-customer-service-2-line"></i>
              Contact Us for Help
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
