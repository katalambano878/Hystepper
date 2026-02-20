import Link from 'next/link';

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-50 via-white to-gold-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 mb-4">Exchange &amp; Refund Policy</h1>
            <p className="text-lg text-gray-500">
              Please read our policy carefully before making a purchase.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 space-y-10">

        {/* Exchange Policy */}
        <section className="bg-gray-900 text-white rounded-2xl p-8 md:p-10 animate-fade-in-up shadow-xl hover:shadow-2xl transition-shadow duration-300 border border-transparent hover:border-gold-500/20">
          <h2 className="text-xl md:text-2xl font-bold text-center tracking-wide uppercase mb-6">Exchange Policy</h2>
          <div className="space-y-4 text-gray-300 text-sm md:text-base leading-relaxed text-center">
            <p>
              We accept exchanges for faulty items. Requests for exchanges of faulty items must be reported within <strong className="text-white">48 hours</strong> after delivery. Exchanges for other issues are reviewed on a case-by-case basis and must be reported within <strong className="text-white">24 hours</strong> after delivery.
            </p>
            <ul className="space-y-2 text-left max-w-xl mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>If the fault is on our side, we will cover the delivery fee for exchanges.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>For size issues or concerns not related to faults, the customer is responsible for the delivery fee.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Refund Policy */}
        <section className="bg-gray-900 text-white rounded-2xl p-8 md:p-10 animate-fade-in-up delay-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 border border-transparent hover:border-gold-500/20">
          <h2 className="text-xl md:text-2xl font-bold text-center tracking-wide uppercase mb-6">Refund Policy</h2>
          <div className="space-y-4 text-gray-300 text-sm md:text-base leading-relaxed text-center">
            <p>
              Refunds are only available for faulty items. If a customer opts not to exchange a faulty item, a refund can be processed. We do not offer refunds for any other reasons.
            </p>
            <ul className="space-y-2 text-left max-w-xl mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>We do not refund delivery fees under any circumstances.</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Important Notice */}
        <section className="bg-gray-900 text-white rounded-2xl p-8 md:p-10 animate-fade-in-up delay-200 shadow-xl hover:shadow-2xl transition-shadow duration-300 border border-transparent hover:border-gold-500/20">
          <h2 className="text-xl md:text-2xl font-bold text-center tracking-wide uppercase mb-6">Important Notice</h2>
          <div className="space-y-3 text-gray-300 text-sm md:text-base leading-relaxed">
            <ul className="space-y-3 max-w-xl mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>Exchanges or refunds are not possible if the item has been used, worn, or appears visibly worn, even if it&apos;s faulty.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>If a faulty item has been used, the case will be reviewed on an individual basis, and other solutions may be offered. However, an exchange or refund is not guaranteed.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>All original packaging, including tags, wraps, and any included items, must be intact for an exchange to be processed.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gold-400 mt-0.5">&bull;</span>
                <span>If any part of the packaging is missing, or if the item has been worn, exchanges will not be accepted.</span>
              </li>
            </ul>
          </div>

          <p className="mt-8 text-center text-white font-bold text-sm md:text-base">
            This policy is subject to review and amendment from time to time. Please check back periodically for any updates.
          </p>
        </section>

        {/* Contact */}
        <section className="text-center py-4">
          <p className="text-gray-500 mb-4">Have questions about our policy?</p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 text-gold-600 hover:text-gold-700 font-semibold transition-colors"
          >
            <i className="ri-customer-service-2-line"></i>
            Contact Us
          </Link>
        </section>

      </div>
    </div>
  );
}
