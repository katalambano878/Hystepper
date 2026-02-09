import Link from 'next/link';

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">Exchange & Refund Policy</h1>
            <p className="text-xl text-gray-600">
              Please read our exchange and refund policy carefully before making a purchase.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="prose prose-lg max-w-none">

          {/* Exchange Policy */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <i className="ri-exchange-line text-emerald-700"></i>
              Exchange Policy
            </h2>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-emerald-900 mb-3">Exchange Window</h3>
              <p className="text-emerald-800">
                All exchange requests must be initiated within <strong>24 hours of delivery</strong>.
                Requests made after the 24-hour window will not be accepted.
              </p>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-4">When Can You Exchange?</h3>
            <p className="text-gray-700 mb-4">Exchanges are accepted in the following cases:</p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl mt-0.5"></i>
                <span className="text-gray-700"><strong>Faulty items</strong> — If the item is defective or damaged upon arrival</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl mt-0.5"></i>
                <span className="text-gray-700"><strong>Sizing issues</strong> — If the item does not match the stated size</span>
              </li>
              <li className="flex items-start gap-3">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl mt-0.5"></i>
                <span className="text-gray-700"><strong>Wrong items delivered</strong> — If you receive an item different from what you ordered</span>
              </li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-4">What Is NOT Eligible for Exchange?</h3>
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <i className="ri-close-circle-fill text-red-500 text-xl mt-0.5"></i>
                  <span className="text-red-900"><strong>Heel height preference</strong> — Heel heights are clearly stated on each product page before purchase</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ri-close-circle-fill text-red-500 text-xl mt-0.5"></i>
                  <span className="text-red-900"><strong>Style preference</strong> — Product style is visible in images and descriptions before purchase</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ri-close-circle-fill text-red-500 text-xl mt-0.5"></i>
                  <span className="text-red-900"><strong>Product preference / change of mind</strong> — We do not accept exchanges for personal preference changes</span>
                </li>
              </ul>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Exchange Delivery Fees</h3>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
                <span className="text-gray-700">
                  If you are exchanging a size that <strong>you personally selected</strong>, you are responsible for the delivery fees for the exchange.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
                <span className="text-gray-700">
                  If we sent the wrong item or a faulty item, we will cover the exchange delivery cost.
                </span>
              </li>
            </ul>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Item Condition for Exchange</h3>
            <p className="text-gray-700 mb-4">All items returned for exchange must meet the following conditions:</p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl mt-0.5"></i>
                <span className="text-gray-700">Items must be <strong>unused and unworn</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl mt-0.5"></i>
                <span className="text-gray-700">Items must be returned with <strong>all original packaging intact</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <i className="ri-checkbox-circle-fill text-emerald-600 text-xl mt-0.5"></i>
                <span className="text-gray-700">Items that show signs of wear will not be accepted for exchange</span>
              </li>
            </ul>
          </section>

          {/* Refund Policy */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <i className="ri-refund-2-line text-emerald-700"></i>
              Refund Policy
            </h2>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-6">
              <h3 className="text-xl font-bold text-blue-900 mb-3">When Do Refunds Apply?</h3>
              <p className="text-blue-800">
                Refunds are only applicable for <strong>faulty or wrong items delivered</strong>, and only if an exchange is not possible (e.g., the correct item is out of stock).
              </p>
            </div>

            <h3 className="text-xl font-bold text-gray-900 mb-4">Refund Process</h3>
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
                <span className="text-gray-700">Contact us within 24 hours of delivery via WhatsApp or Instagram</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
                <span className="text-gray-700">Provide your order number, photos of the issue, and a description</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</span>
                <span className="text-gray-700">Our team will review and respond promptly</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-7 h-7 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">4</span>
                <span className="text-gray-700">If approved, refunds will be processed to your original payment method</span>
              </li>
            </ul>
          </section>

          {/* Delivery Fees */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <i className="ri-truck-line text-emerald-700"></i>
              Delivery Fee Policy
            </h2>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6">
              <p className="text-amber-900 font-medium">
                Delivery fees are <strong>non-refundable</strong> once delivery is completed or once the rider has been directed to your location.
              </p>
            </div>
          </section>

          {/* Order Cancellation */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <i className="ri-close-circle-line text-emerald-700"></i>
              Order Cancellation
            </h2>

            <p className="text-gray-700 mb-4">
              Orders <strong>cannot be cancelled by customers</strong> on the website. Only our admin team can cancel orders.
              If you need to request a cancellation, please contact us immediately via WhatsApp or Instagram.
            </p>
            <p className="text-gray-700">
              If your order is cancelled by our team, a refund will be processed to your original payment method.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-8">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Need Help?</h3>
              <p className="text-gray-600 mb-6">
                If you have any questions about our exchange and refund policy, please don&apos;t hesitate to reach out.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/contact" className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-800 transition-colors">
                  <i className="ri-customer-service-2-line"></i>
                  Contact Us
                </Link>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}
