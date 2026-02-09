'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function SizeGuidePage() {
  const [unit, setUnit] = useState<'cm' | 'inches'>('cm');

  const sizeChart = [
    { eu: 35, uk: 2.5, us: 5, cm: 22.0, inches: 8.66 },
    { eu: 36, uk: 3.5, us: 6, cm: 22.5, inches: 8.86 },
    { eu: 37, uk: 4, us: 6.5, cm: 23.5, inches: 9.25 },
    { eu: 38, uk: 5, us: 7.5, cm: 24.0, inches: 9.45 },
    { eu: 39, uk: 6, us: 8.5, cm: 25.0, inches: 9.84 },
    { eu: 40, uk: 6.5, us: 9, cm: 25.5, inches: 10.04 },
    { eu: 41, uk: 7.5, us: 10, cm: 26.0, inches: 10.24 },
    { eu: 42, uk: 8, us: 10.5, cm: 27.0, inches: 10.63 },
    { eu: 43, uk: 9, us: 11.5, cm: 27.5, inches: 10.83 },
  ];

  const steps = [
    {
      number: 1,
      title: 'Place paper on the floor',
      description: 'Place a sheet of paper on a hard, flat surface. Stand on the paper with your heel against a wall.',
      icon: 'ri-file-paper-2-line'
    },
    {
      number: 2,
      title: 'Mark your foot',
      description: 'Using a pen or pencil, mark the tip of your longest toe and the back of your heel on the paper.',
      icon: 'ri-pencil-ruler-2-line'
    },
    {
      number: 3,
      title: 'Measure the length',
      description: 'Use a ruler to measure the distance between the two marks. This is your foot length.',
      icon: 'ri-ruler-line'
    },
    {
      number: 4,
      title: 'Find your size',
      description: 'Compare your foot length to our size chart below to find your perfect size. If between sizes, we recommend sizing up.',
      icon: 'ri-search-line'
    }
  ];

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

        {/* How to Measure */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">How to Measure Your Feet</h2>
          <p className="text-gray-600 text-center mb-10 max-w-2xl mx-auto">
            Follow these simple steps to measure your feet at home. We recommend measuring in the evening when your feet are slightly larger.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step) => (
              <div key={step.number} className="relative p-6 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <i className={`${step.icon} text-xl text-emerald-700`}></i>
                </div>
                <div className="absolute top-4 right-4 w-8 h-8 bg-emerald-700 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  {step.number}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Size Chart */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-gray-900">Size Chart</h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setUnit('cm')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  unit === 'cm' ? 'bg-emerald-700 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Centimeters
              </button>
              <button
                onClick={() => setUnit('inches')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  unit === 'inches' ? 'bg-emerald-700 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Inches
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-emerald-700 text-white">
                  <th className="py-4 px-6 text-left font-semibold rounded-tl-xl">EU Size</th>
                  <th className="py-4 px-6 text-left font-semibold">UK Size</th>
                  <th className="py-4 px-6 text-left font-semibold">US Size</th>
                  <th className="py-4 px-6 text-left font-semibold rounded-tr-xl">
                    Foot Length ({unit === 'cm' ? 'cm' : 'in'})
                  </th>
                </tr>
              </thead>
              <tbody>
                {sizeChart.map((row, idx) => (
                  <tr
                    key={row.eu}
                    className={`border-b border-gray-100 transition-colors hover:bg-emerald-50 ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}
                  >
                    <td className="py-4 px-6 font-bold text-gray-900 text-lg">{row.eu}</td>
                    <td className="py-4 px-6 text-gray-700">{row.uk}</td>
                    <td className="py-4 px-6 text-gray-700">{row.us}</td>
                    <td className="py-4 px-6 text-gray-700 font-medium">
                      {unit === 'cm' ? `${row.cm} cm` : `${row.inches}"`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Tips */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Fitting Tips</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 bg-blue-50 rounded-xl border border-blue-100">
              <i className="ri-time-line text-3xl text-blue-600 mb-4 block"></i>
              <h3 className="font-bold text-gray-900 mb-2">Measure in the Evening</h3>
              <p className="text-sm text-gray-600">Feet tend to swell slightly throughout the day. Measuring in the evening ensures a more comfortable fit.</p>
            </div>
            <div className="p-6 bg-amber-50 rounded-xl border border-amber-100">
              <i className="ri-arrow-up-down-line text-3xl text-amber-600 mb-4 block"></i>
              <h3 className="font-bold text-gray-900 mb-2">Between Sizes? Go Up</h3>
              <p className="text-sm text-gray-600">If your measurement falls between two sizes, we recommend choosing the larger size for a more comfortable fit.</p>
            </div>
            <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
              <i className="ri-footprint-line text-3xl text-emerald-600 mb-4 block"></i>
              <h3 className="font-bold text-gray-900 mb-2">Measure Both Feet</h3>
              <p className="text-sm text-gray-600">One foot is often slightly larger than the other. Always use the measurement of your larger foot when selecting a size.</p>
            </div>
          </div>
        </section>

        {/* Heel Height Guide */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">Heel Height Guide</h2>
          <p className="text-gray-600 text-center mb-8">Understanding heel heights helps you choose the right shoe for the occasion</p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { height: 'Flat (0-1")', comfort: 'Maximum comfort', best: 'Daily wear, walking', icon: '👟' },
              { height: 'Low (1-2")', comfort: 'Very comfortable', best: 'Work, casual outings', icon: '👢' },
              { height: 'Mid (2-3")', comfort: 'Moderate comfort', best: 'Events, dinners', icon: '👠' },
              { height: 'High (3"+)', comfort: 'Statement piece', best: 'Special occasions', icon: '💃' },
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

        {/* Important Note */}
        <section className="mb-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <i className="ri-error-warning-line text-amber-600 text-xl mt-0.5"></i>
              <div>
                <h3 className="font-bold text-amber-900 mb-2">Important: Exchanges for sizing</h3>
                <p className="text-sm text-amber-800">
                  If you select a size and it doesn&apos;t fit, exchanges are possible within 24 hours of delivery.
                  However, <strong>you will be responsible for the delivery fees</strong> for exchanging a size you personally selected.
                  Please measure carefully using the guide above to avoid this.
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
