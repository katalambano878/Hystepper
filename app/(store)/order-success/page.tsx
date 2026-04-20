'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const paymentSuccessFlag = searchParams.get('payment_success') === 'true';
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);

  const fetchOrder = async () => {
    if (!orderNumber) return null;
    const { data: orderData, error } = await supabase
      .from('orders')
      .select(`*, order_items (*)`)
      .eq('order_number', orderNumber)
      .single();
    if (error) throw error;
    return orderData;
  };

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!orderNumber) {
        setLoading(false);
        return;
      }

      try {
        let orderData = await fetchOrder();
        if (cancelled) return;

        // Auto-reconcile: if we returned from Moolre but the async webhook hasn't
        // flipped the order to paid yet, query Moolre directly and update the order.
        const needsReconcile =
          paymentSuccessFlag &&
          orderData &&
          orderData.payment_method === 'moolre' &&
          orderData.payment_status !== 'paid' &&
          orderData.payment_status !== 'refunded';

        if (needsReconcile) {
          // Moolre can take 10-60s to register a transaction on their side, so
          // we poll a few times: wait, refetch the order (webhook may have
          // landed), and if still unpaid ask /reconcile to verify directly.
          const waitSteps = [3000, 5000, 7000, 10000]; // ~25s of attempts total
          for (const wait of waitSteps) {
            if (cancelled) return;
            await new Promise((resolve) => setTimeout(resolve, wait));
            if (cancelled) return;

            try {
              const refreshed = await fetchOrder();
              if (refreshed?.payment_status === 'paid') {
                orderData = refreshed;
                break;
              }

              // Webhook hasn't landed — verify with Moolre directly.
              const res = await fetch('/api/payment/moolre/reconcile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderNumber }),
              });
              const payload = await res.json().catch(() => ({}));
              const after = await fetchOrder();
              if (after?.payment_status === 'paid') {
                orderData = after;
                break;
              }
              if (payload?.status === 'failed') {
                orderData = after ?? orderData;
                break;
              }
              // payload.status === 'pending' / 'unknown' — try again.
            } catch (reconErr) {
              console.warn('Auto-reconcile attempt failed (non-blocking):', reconErr);
            }
          }
        }

        if (!cancelled) setOrder(orderData);
      } catch (err) {
        console.error('Error fetching order:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [orderNumber, paymentSuccessFlag]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-4xl text-gold-700 animate-spin mb-4 block"></i>
          <p className="text-gray-500">Loading order details...</p>
        </div>
      </div>
    );
  }

  // Use a fallback or nice error if order not found
  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="ri-error-warning-line text-4xl text-red-500 mb-4 block"></i>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-6">We couldn't locate the order details.</p>
          <Link href="/shop" className="text-gold-700 font-semibold hover:underline">
            Return to Shop
          </Link>
        </div>
      </main>
    );
  }

  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const estimatedDelivery = new Date(new Date(order.created_at).getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const pointsEarned = Math.floor(order.total / 10);

  const shippingAddr = order.shipping_address || {};
  const recipientName = [shippingAddr.firstName, shippingAddr.lastName].filter(Boolean).join(' ').trim() || 'Customer';
  const addressLines = [
    shippingAddr.address,
    [shippingAddr.city, shippingAddr.region].filter(Boolean).join(', '),
    shippingAddr.postalCode,
  ].filter(Boolean);

  const steps = [
    { key: 'confirmed', label: 'Confirmed', icon: 'ri-checkbox-circle-line', done: true },
    { key: 'processing', label: 'Processing', icon: 'ri-loader-4-line', done: false, current: true },
    { key: 'shipped', label: 'Shipped', icon: 'ri-truck-line', done: false },
    { key: 'delivered', label: 'Delivered', icon: 'ri-home-smile-2-line', done: false },
  ];

  return (
    <main className="min-h-screen bg-[#fafaf7]">
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {[...Array(36)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${Math.random() * 20}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`
              }}
            >
              <i className={`ri-${['heart', 'star', 'sparkling'][Math.floor(Math.random() * 3)]}-fill text-${['yellow', 'amber', 'orange'][Math.floor(Math.random() * 3)]}-400 text-lg opacity-80`}></i>
            </div>
          ))}
        </div>
      )}

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-gold-50 via-amber-50/40 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold tracking-wide uppercase mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Payment received
            </div>
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full bg-gold-100 animate-ping opacity-60" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-gold-500 to-amber-600 flex items-center justify-center shadow-lg shadow-gold-200">
                <i className="ri-check-line text-white text-4xl font-bold" />
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
              Thank you, {recipientName.split(' ')[0]}.
            </h1>
            <p className="text-base sm:text-lg text-gray-600 max-w-xl mx-auto">
              Your order <span className="font-semibold text-gray-900">{order.order_number}</span> is confirmed. A receipt is on its way to <span className="text-gray-900">{order.email}</span>.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Order</p>
                <p className="font-semibold text-gray-900">{order.order_number}</p>
              </div>
              <div className="w-px h-10 bg-gray-200" />
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Placed</p>
                <p className="font-semibold text-gray-900">{orderDate}</p>
              </div>
              <div className="w-px h-10 bg-gray-200 hidden sm:block" />
              <div className="hidden sm:block">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">Est. delivery</p>
                <p className="font-semibold text-gold-700">{estimatedDelivery}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                href="/account?tab=orders"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-gray-900 hover:bg-black text-white text-sm font-semibold transition-colors"
              >
                <i className="ri-file-list-3-line mr-1.5" />
                View order
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-gray-300 hover:border-gray-900 hover:text-gray-900 text-gray-700 text-sm font-semibold transition-colors"
              >
                Keep shopping
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-sm mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Order progress</h2>
            <span className="text-xs text-gray-500">Real-time</span>
          </div>
          <div className="relative">
            <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
            <div className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-gold-500 to-amber-500" style={{ width: '25%' }} />
            <div className="relative grid grid-cols-4 gap-2">
              {steps.map((step) => (
                <div key={step.key} className="flex flex-col items-center text-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                      step.done
                        ? 'bg-gradient-to-br from-gold-500 to-amber-600 border-transparent text-white shadow-md shadow-gold-200'
                        : step.current
                        ? 'bg-white border-gold-500 text-gold-600'
                        : 'bg-white border-gray-200 text-gray-300'
                    }`}
                  >
                    <i className={`${step.icon} text-lg ${step.current ? 'animate-spin-slow' : ''}`} />
                  </div>
                  <p className={`mt-2 text-xs font-semibold ${step.done || step.current ? 'text-gray-900' : 'text-gray-400'}`}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900">Your items</h2>
              <span className="text-sm text-gray-500">{order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="divide-y divide-gray-100">
              {order.order_items.map((item: any) => (
                <div key={item.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-50 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.metadata?.image || 'https://via.placeholder.com/150'}
                      alt={item.product_name}
                      className="w-full h-full object-cover object-center"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{item.product_name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      {item.variant_name && (
                        <>
                          <span>{item.variant_name}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                        </>
                      )}
                      <span>Qty {item.quantity}</span>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 text-right whitespace-nowrap">
                    GH₵{(item.unit_price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 mt-6 pt-5 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>GH₵{order.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span>GH₵{order.shipping_total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between pt-3 mt-2 border-t border-gray-100">
                <span className="text-base font-bold text-gray-900">Total paid</span>
                <span className="text-lg font-bold text-gold-700">GH₵{order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Delivery to</h2>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="font-semibold text-gray-900">{recipientName}</p>
                  {addressLines.map((line, i) => (
                    <p key={i} className="text-gray-600">{line}</p>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                  <i className="ri-phone-line text-gray-400" />
                  <span className="text-gray-700">{order.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="ri-mail-line text-gray-400" />
                  <span className="text-gray-700 truncate">{order.email}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-lg font-bold text-gray-900 mb-5">What happens next</h2>
              <ol className="relative space-y-5">
                <div className="absolute left-[15px] top-6 bottom-6 w-px bg-gray-100" />
                <li className="relative flex gap-4">
                  <div className="relative w-8 h-8 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center flex-shrink-0">
                    <i className="ri-mail-send-line text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Email confirmation</p>
                    <p className="text-xs text-gray-500 mt-0.5">Sent to {order.email}</p>
                  </div>
                </li>
                <li className="relative flex gap-4">
                  <div className="relative w-8 h-8 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center flex-shrink-0">
                    <i className="ri-box-3-line text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">We pack with care</p>
                    <p className="text-xs text-gray-500 mt-0.5">Dispatched within 24 hours</p>
                  </div>
                </li>
                <li className="relative flex gap-4">
                  <div className="relative w-8 h-8 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center flex-shrink-0">
                    <i className="ri-truck-line text-gold-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Live tracking</p>
                    <p className="text-xs text-gray-500 mt-0.5">Updates via email & SMS</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div className="mt-6 relative overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-gold-900 p-6 sm:p-8 text-white">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-gold-500/20 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold-400 to-amber-500 flex items-center justify-center flex-shrink-0">
                <i className="ri-sparkling-2-fill text-white text-xl" />
              </div>
              <div>
                <p className="font-bold text-lg">You earned {pointsEarned} Sleek Points</p>
                <p className="text-sm text-white/70">Create an account to redeem on your next order.</p>
              </div>
            </div>
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white text-gray-900 text-sm font-semibold hover:bg-gold-50 transition-colors whitespace-nowrap"
            >
              Claim points
              <i className="ri-arrow-right-line ml-1.5" />
            </Link>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 mb-3">Need a hand with your order?</p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm">
            <Link href="/contact" className="text-gray-700 hover:text-gold-700 font-medium inline-flex items-center whitespace-nowrap">
              <i className="ri-customer-service-2-line mr-1.5" />
              Contact support
            </Link>
            <Link href="/account/orders" className="text-gray-700 hover:text-gold-700 font-medium inline-flex items-center whitespace-nowrap">
              <i className="ri-question-line mr-1.5" />
              Order help
            </Link>
            <Link href="/policy" className="text-gray-700 hover:text-gold-700 font-medium inline-flex items-center whitespace-nowrap">
              <i className="ri-arrow-left-right-line mr-1.5" />
              Exchange & refund
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
        @keyframes spin-slow {
          to { transform: rotate(360deg); }
        }
        :global(.animate-spin-slow) {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-gold-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
