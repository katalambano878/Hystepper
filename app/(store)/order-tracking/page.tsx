'use client';

import Link from 'next/link';
import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const urlOrderNumber = searchParams.get('order') || '';

  const [orderNumber, setOrderNumber] = useState(urlOrderNumber);
  const [email, setEmail] = useState('');
  const [isTracking, setIsTracking] = useState(!!urlOrderNumber);
  const [error, setError] = useState('');

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orderNumber || !email) {
      setError('Please fill in all fields');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsTracking(true);
  };

  const trackingSteps = [
    {
      status: 'completed',
      title: 'Order Placed',
      description: 'Your order has been confirmed',
      date: '15 Jan 2024, 10:30 AM',
      icon: 'ri-checkbox-circle-line'
    },
    {
      status: 'completed',
      title: 'Processing',
      description: 'Your order is being prepared',
      date: '15 Jan 2024, 2:15 PM',
      icon: 'ri-box-3-line'
    },
    {
      status: 'active',
      title: 'Shipped',
      description: 'Your order is on the way',
      date: '16 Jan 2024, 9:00 AM',
      icon: 'ri-truck-line'
    },
    {
      status: 'pending',
      title: 'Out for Delivery',
      description: 'Your order is out for delivery',
      date: 'Pending',
      icon: 'ri-map-pin-line'
    },
    {
      status: 'pending',
      title: 'Delivered',
      description: 'Your order has been delivered',
      date: 'Pending',
      icon: 'ri-home-smile-line'
    }
  ];

  if (!isTracking) {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Track Your Order</h1>
            <p className="text-gray-600">Enter your order details to track your shipment</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-8">
            <form onSubmit={handleTrack} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Order Number
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  placeholder="ORD-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-500 focus:border-gold-500"
                  placeholder="you@example.com"
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-gold-600 hover:bg-gold-700 text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Track Order
              </button>
            </form>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-xl text-blue-700 mt-0.5"></i>
                <div>
                  <p className="text-sm font-semibold text-blue-900">Need Help?</p>
                  <p className="text-sm text-blue-700 mt-1">
                    You can find your order number in the confirmation email we sent you.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap">
              <i className="ri-arrow-left-line mr-2"></i>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/order-tracking" onClick={() => setIsTracking(false)} className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Track Another Order
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Order {orderNumber}</h1>
              <p className="text-gray-600 mt-1">Estimated delivery: 20 Jan 2024</p>
            </div>
            <div className="px-4 py-2 bg-gold-100 text-gold-800 rounded-full font-semibold whitespace-nowrap">
              In Transit
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-gold-100 rounded-full">
                  <i className="ri-map-pin-line text-xl text-gold-700"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Shipping To</p>
                  <p className="font-semibold text-gray-900">Accra, Ghana</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-gold-100 rounded-full">
                  <i className="ri-truck-line text-xl text-gold-700"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Carrier</p>
                  <p className="font-semibold text-gray-900">Express Delivery</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 flex items-center justify-center bg-gold-100 rounded-full">
                  <i className="ri-box-3-line text-xl text-gold-700"></i>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Items</p>
                  <p className="font-semibold text-gray-900">2 Products</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            {trackingSteps.map((step, index) => (
              <div key={index} className="flex items-start mb-8 last:mb-0">
                <div className="relative flex flex-col items-center mr-6">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-full font-bold transition-colors ${step.status === 'completed'
                      ? 'bg-gold-600 text-white'
                      : step.status === 'active'
                        ? 'bg-gold-100 text-gold-700 ring-4 ring-gold-200'
                        : 'bg-gray-200 text-gray-500'
                    }`}>
                    <i className={`${step.icon} text-xl`}></i>
                  </div>
                  {index < trackingSteps.length - 1 && (
                    <div className={`w-0.5 h-16 mt-2 ${step.status === 'completed' ? 'bg-gold-600' : 'bg-gray-200'
                      }`}></div>
                  )}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className={`font-bold text-lg ${step.status === 'pending' ? 'text-gray-500' : 'text-gray-900'
                    }`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm mt-1 ${step.status === 'pending' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                    {step.description}
                  </p>
                  <p className={`text-sm mt-1 font-semibold ${step.status === 'pending' ? 'text-gray-400' : 'text-gold-700'
                    }`}>
                    {step.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Order Items</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src="https://readdy.ai/api/search-image?query=Premium%20wireless%20headphones%20with%20sleek%20black%20design%20and%20cushioned%20ear%20cups%20on%20clean%20white%20background%2C%20product%20photography%20style%2C%20professional%20lighting%2C%20high%20quality%2C%20minimalist%20aesthetic&width=400&height=400&seq=track1&orientation=squarish"
                  alt="Product"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Premium Wireless Headphones</h3>
                <p className="text-sm text-gray-600 mt-1">Quantity: 1</p>
              </div>
              <p className="font-bold text-gold-700">GH₵ 450.00</p>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src="https://readdy.ai/api/search-image?query=Modern%20smart%20fitness%20watch%20with%20black%20band%20and%20digital%20display%20showing%20health%20metrics%20on%20clean%20white%20background%2C%20product%20photography%20style%2C%20professional%20lighting%2C%20high%20quality%2C%20minimalist%20aesthetic&width=400&height=400&seq=track2&orientation=squarish"
                  alt="Product"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">Smart Fitness Watch</h3>
                <p className="text-sm text-gray-600 mt-1">Quantity: 1</p>
              </div>
              <p className="font-bold text-gold-700">GH₵ 320.00</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gold-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </main>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
