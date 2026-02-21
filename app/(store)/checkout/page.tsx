'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import OrderSummary from '@/components/OrderSummary';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();

  const [isLoading, setIsLoading] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'guest' | 'account'>('guest');
  const [saveAddress, setSaveAddress] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [shippingData, setShippingData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: '',
  });

  const [regions, setRegions] = useState<any[]>([]);

  const [paymentOption, setPaymentOption] = useState<'full_payment' | 'item_only'>('full_payment');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState('');

  // Loyalty
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    nextDayDelivery: false,
    deliveryUnavailable: false
  });

  const activeZone = regions.find(r => r.name === shippingData.region);
  const isAccra = activeZone?.is_accra || false;

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setCheckoutType('account');
        setShippingData(prev => ({ ...prev, email: session.user.email || '' }));

        const { data: pointsData } = await supabase
          .from('loyalty_points')
          .select('points')
          .eq('user_id', session.user.id)
          .single();

        if (pointsData) {
          setLoyaltyPoints(pointsData.points || 0);
        }
      }

      const { data: settingsData } = await supabase
        .from('store_settings')
        .select('key, value')
        .in('key', ['next_day_delivery_enabled', 'delivery_unavailable']);

      if (settingsData) {
        const nextDay = settingsData.find(s => s.key === 'next_day_delivery_enabled')?.value === true || settingsData.find(s => s.key === 'next_day_delivery_enabled')?.value === 'true';
        const unavailable = settingsData.find(s => s.key === 'delivery_unavailable')?.value === true || settingsData.find(s => s.key === 'delivery_unavailable')?.value === 'true';
        setSettings({ nextDayDelivery: nextDay, deliveryUnavailable: unavailable });
      }

      const { data: zonesData } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (zonesData) {
        setRegions(zonesData);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!isAccra && paymentOption === 'item_only') {
      setPaymentOption('full_payment');
    }
  }, [isAccra, paymentOption]);

  // Calculate Totals
  const subtotal = cartSubtotal;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const baseFee = activeZone?.base_fee || 0;
  const perItemFee = activeZone?.per_item_fee || 0;
  const zoneFee = isAccra ? baseFee : baseFee + (perItemFee * totalItems);
  const shippingCost = zoneFee;

  const pointsDiscount = (redeemPoints && loyaltyPoints >= 15 && !couponApplied) ? Math.min(loyaltyPoints, subtotal) : 0;
  const totalDiscount = couponApplied ? couponDiscount : pointsDiscount;

  const tax = 0;
  const totalBeforeSplit = subtotal + shippingCost + tax - totalDiscount;

  const deliveryFeeToPayLater = paymentOption === 'item_only' ? shippingCost : 0;
  const payableNow = totalBeforeSplit - deliveryFeeToPayLater;
  const total = totalBeforeSplit;

  const validateShipping = () => {
    const newErrors: any = {};
    if (!shippingData.firstName) newErrors.firstName = 'First name is required';
    if (!shippingData.lastName) newErrors.lastName = 'Last name is required';
    if (!shippingData.phone) newErrors.phone = 'Phone is required';
    if (!shippingData.address) newErrors.address = 'Address is required';
    if (!shippingData.region) newErrors.region = 'Region is required';

    // Email is optional — but validate format if provided
    if (shippingData.email && !/\S+@\S+\.\S+/.test(shippingData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError('');

    try {
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.trim().toUpperCase())
        .eq('is_active', true)
        .single();

      if (error || !coupon) {
        setCouponError('Invalid or expired coupon code');
        setCouponLoading(false);
        return;
      }

      if (coupon.start_date && new Date(coupon.start_date) > new Date()) {
        setCouponError('This coupon is not yet active');
        setCouponLoading(false);
        return;
      }
      if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
        setCouponError('This coupon has expired');
        setCouponLoading(false);
        return;
      }

      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        setCouponError('This coupon has reached its usage limit');
        setCouponLoading(false);
        return;
      }

      if (coupon.minimum_purchase && subtotal < coupon.minimum_purchase) {
        setCouponError(`Minimum purchase of GH₵ ${coupon.minimum_purchase} required`);
        setCouponLoading(false);
        return;
      }

      if (redeemPoints) {
        setRedeemPoints(false);
      }

      let discount = 0;
      if (coupon.type === 'percentage') {
        discount = (subtotal * coupon.value) / 100;
        if (coupon.maximum_discount) {
          discount = Math.min(discount, coupon.maximum_discount);
        }
      } else if (coupon.type === 'fixed_amount') {
        discount = Math.min(coupon.value, subtotal);
      }

      setCouponDiscount(discount);
      setCouponApplied(coupon);
    } catch (err) {
      setCouponError('Failed to apply coupon');
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setCouponApplied(null);
    setCouponDiscount(0);
    setCouponCode('');
    setCouponError('');
  };

  const handleProceedToPayment = () => {
    if (!validateShipping()) return;
    if (!acceptedPolicy) {
      alert('Please accept the Exchange & Refund Policy to proceed.');
      return;
    }
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    setShowPaymentModal(true);
  };

  const handlePlaceOrder = async (gateway: 'paystack' | 'moolre') => {
    setIsLoading(true);
    setShowPaymentModal(false);

    try {
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          user_id: user?.id || null,
          email: shippingData.email || null,
          phone: shippingData.phone,
          status: 'pending',
          payment_status: 'pending',
          currency: 'GHS',
          subtotal: subtotal,
          tax_total: tax,
          shipping_total: shippingCost,
          discount_total: totalDiscount,
          total: total,
          shipping_method: 'standard',
          payment_method: gateway,
          payment_option: paymentOption,
          delivery_notes: deliveryNotes,
          points_redeemed: pointsDiscount > 0 ? pointsDiscount : 0,
          points_discount: pointsDiscount,
          shipping_address: shippingData,
          billing_address: shippingData,
          metadata: {
            guest_checkout: !user,
            first_name: shippingData.firstName,
            last_name: shippingData.lastName,
            region: shippingData.region,
            payable_now: payableNow,
            delivery_fee_due: deliveryFeeToPayLater,
            coupon_code: couponApplied?.code || null,
            coupon_discount: couponDiscount || 0
          }
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create Order Items
      const orderItems = [
        ...cart.map(item => ({
          order_id: order.id,
          product_id: item.id,
          product_name: item.name,
          variant_name: item.variant,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          metadata: {
            image: item.image,
            slug: item.slug
          }
        }))
      ];

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Increment coupon usage
      if (couponApplied) {
        await supabase
          .from('coupons')
          .update({ usage_count: (couponApplied.usage_count || 0) + 1 })
          .eq('id', couponApplied.id);
      }

      // Deduct Points if used
      if (pointsDiscount > 0 && user) {
        await supabase
          .from('loyalty_points')
          .update({ points: loyaltyPoints - pointsDiscount, updated_at: new Date().toISOString() })
          .eq('user_id', user.id);

        await supabase.from('loyalty_transactions').insert({
          user_id: user.id,
          order_id: order.id,
          amount: -pointsDiscount,
          type: 'redemption',
          description: `Redeemed ${pointsDiscount} points (GH₵ ${pointsDiscount.toFixed(2)} off) on order ${orderNumber}`
        });
      }

      // Send confirmation SMS only
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order_confirmation',
            payload: {
              email: shippingData.email || null,
              name: `${shippingData.firstName} ${shippingData.lastName}`,
              orderNumber: orderNumber,
              subtotal: subtotal,
              shipping: shippingCost,
              discount: totalDiscount,
              total: total,
              payableNow: payableNow,
              items: cart.map(item => ({
                name: item.name,
                variant: item.variant,
                quantity: item.quantity,
                price: item.price
              })),
              shippingAddress: shippingData,
              phone: shippingData.phone,
              paymentOption: paymentOption
            }
          })
        });
      } catch (notifErr) {
        console.error('Failed to send confirmation:', notifErr);
      }

      // Handle Payment
      if (payableNow <= 0) {
        clearCart();
        router.push(`/order-success?order=${orderNumber}`);
        return;
      }

      if (gateway === 'moolre') {
        const paymentRes = await fetch('/api/payment/moolre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderNumber,
            amount: payableNow,
            customerEmail: shippingData.email || 'no-email@checkout.local'
          })
        });

        const paymentResult = await paymentRes.json();

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment initialization failed');
        }

        clearCart();
        window.location.href = paymentResult.url;
        return;
      }

      if (gateway === 'paystack') {
        const paymentRes = await fetch('/api/payment/paystack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderNumber,
            amount: payableNow,
            customerEmail: shippingData.email || 'no-email@checkout.local',
            customerPhone: shippingData.phone
          })
        });

        const paymentResult = await paymentRes.json();

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment initialization failed');
        }

        clearCart();
        window.location.href = paymentResult.url;
        return;
      }

      clearCart();
      router.push(`/order-success?order=${orderNumber}`);

    } catch (err: any) {
      console.error('Checkout error:', err);
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };


  if (cart.length === 0 && !isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 py-20">
        <div className="max-w-md mx-auto text-center px-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <i className="ri-shopping-cart-line text-4xl text-gray-300"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h1>
          <p className="text-gray-600 mb-8">Add some items to start the checkout process.</p>
          <Link href="/shop" className="inline-block bg-gold-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-gold-700 transition-colors">
            Return to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/cart" className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Cart
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        {/* Checkout Type Selection */}
        <div className="mb-6 bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Checkout As</h2>
          <div className="grid md:grid-cols-2 gap-3">
            <button
              onClick={() => !user && setCheckoutType('guest')}
              className={`p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${checkoutType === 'guest'
                ? 'border-gold-500 bg-gold-50'
                : 'border-gray-200 hover:border-gray-300'
                } ${user ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!!user}
            >
              <div className="flex items-center justify-between mb-2">
                <i className="ri-user-line text-2xl text-gold-600"></i>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checkoutType === 'guest' ? 'border-gold-500 bg-gold-500' : 'border-gray-300'}`}>
                  {checkoutType === 'guest' && <i className="ri-check-line text-white text-xs"></i>}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Guest Checkout</h3>
              <p className="text-xs text-gray-600">Quick checkout without an account</p>
              {user && <p className="text-xs text-gold-600 mt-1">You are logged in</p>}
            </button>

            <button
              onClick={() => setCheckoutType('account')}
              className={`p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${checkoutType === 'account'
                ? 'border-gold-500 bg-gold-50'
                : 'border-gray-200 hover:border-gray-300'
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <i className="ri-account-circle-line text-2xl text-gold-600"></i>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${checkoutType === 'account' ? 'border-gold-500 bg-gold-500' : 'border-gray-300'}`}>
                  {checkoutType === 'account' && <i className="ri-check-line text-white text-xs"></i>}
                </div>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{user ? 'My Account' : 'Create Account'}</h3>
              <p className="text-xs text-gray-600">
                {user ? `Logged in as ${user.email}` : 'Save info, track orders & earn loyalty points'}
              </p>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* Shipping Information */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Shipping Information</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">First Name *</label>
                    <input
                      type="text"
                      value={shippingData.firstName}
                      onChange={(e) => setShippingData({ ...shippingData, firstName: e.target.value })}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="John"
                    />
                    {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      value={shippingData.lastName}
                      onChange={(e) => setShippingData({ ...shippingData, lastName: e.target.value })}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Doe"
                    />
                    {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Email Address <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="email"
                    value={shippingData.email}
                    readOnly={!!user}
                    onChange={(e) => setShippingData({ ...shippingData, email: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.email ? 'border-red-500' : 'border-gray-300'} ${user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    value={shippingData.phone}
                    onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="+233 XX XXX XXXX"
                  />
                  {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Delivery Location *</label>
                  <input
                    type="text"
                    value={shippingData.address}
                    onChange={(e) => setShippingData({ ...shippingData, address: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Area / Landmark / Street name"
                  />
                  {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Region *</label>
                  <select
                    value={shippingData.region}
                    onChange={(e) => setShippingData({ ...shippingData, region: e.target.value })}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.region ? 'border-red-500' : 'border-gray-300'} bg-white`}
                  >
                    <option value="">Select Region</option>
                    {regions.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                  {errors.region && <p className="text-sm text-red-600 mt-1">{errors.region}</p>}
                </div>

                {checkoutType === 'account' && (
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAddress}
                      onChange={(e) => setSaveAddress(e.target.checked)}
                      className="w-5 h-5 text-gold-600 rounded border-gray-300 focus:ring-gold-400"
                    />
                    <span className="text-sm text-gray-700">Save this address for future orders</span>
                  </label>
                )}
              </div>
            </div>

            {/* Delivery Info */}
            {shippingData.region && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery</h2>

                {settings.deliveryUnavailable ? (
                  <div className="p-5 bg-red-50 border border-red-200 rounded-xl text-center">
                    <i className="ri-truck-line text-3xl text-red-400 mb-2 block"></i>
                    <h3 className="text-lg font-bold text-red-900 mb-1">Delivery Unavailable Today</h3>
                    <p className="text-sm text-red-700">We are not dispatching deliveries at this time. Please check back later.</p>
                  </div>
                ) : (
                  <>
                    {settings.nextDayDelivery && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                        <i className="ri-information-line text-blue-600 mt-0.5"></i>
                        <p className="text-sm text-blue-800">
                          <strong>Next-day delivery is active.</strong> All orders placed today will be delivered tomorrow.
                        </p>
                      </div>
                    )}

                    <div className="p-4 border-2 border-gold-300 bg-gold-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {settings.nextDayDelivery ? 'Next-Day Delivery' : 'Standard Delivery'}
                          </p>
                          <p className="text-sm text-gray-600">
                            {settings.nextDayDelivery
                              ? 'Delivered tomorrow'
                              : `Within ${isAccra ? '1-2' : '3-5'} business days`
                            }
                          </p>
                        </div>
                        <p className="font-bold text-gray-900">GH₵ {shippingCost.toFixed(2)}</p>
                      </div>
                    </div>

                    {!isAccra && activeZone?.transport_service && (
                      <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2">
                        <i className="ri-bus-line text-gray-600 mt-0.5"></i>
                        <p className="text-sm text-gray-700">
                          Delivery to <strong>{activeZone.name}</strong> via <strong>{activeZone.transport_service}</strong>.
                          {perItemFee > 0 && (
                            <span className="block mt-1 text-gray-500">
                              Fee: GH₵ {baseFee.toFixed(2)} base + GH₵ {perItemFee.toFixed(2)} × {totalItems} item{totalItems !== 1 ? 's' : ''} = GH₵ {shippingCost.toFixed(2)}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <i className="ri-map-pin-line text-amber-600 mt-0.5"></i>
                      <p className="text-sm text-amber-800">
                        Don&apos;t see your location? Contact us on <strong>WhatsApp</strong> or <strong>Instagram</strong>.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Payment Breakdown for Accra */}
            {isAccra && shippingData.region && !settings.deliveryUnavailable && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Option</h2>
                <div className="space-y-3">
                  <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentOption === 'full_payment' ? 'border-gold-500 bg-gold-50' : 'border-gray-200'}`}>
                    <input type="radio" name="payment_option" value="full_payment" checked={paymentOption === 'full_payment'} onChange={() => setPaymentOption('full_payment')} className="w-5 h-5 text-gold-600 mt-0.5 mr-3" />
                    <div>
                      <p className="font-semibold text-gray-900">Pay Full Amount Now</p>
                      <p className="text-sm text-gray-600">Item cost + Delivery Fee</p>
                    </div>
                  </label>
                  <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentOption === 'item_only' ? 'border-gold-500 bg-gold-50' : 'border-gray-200'}`}>
                    <input type="radio" name="payment_option" value="item_only" checked={paymentOption === 'item_only'} onChange={() => setPaymentOption('item_only')} className="w-5 h-5 text-gold-600 mt-0.5 mr-3" />
                    <div>
                      <p className="font-semibold text-gray-900">Pay Item Cost Only</p>
                      <p className="text-sm text-gray-600">Pay delivery fee upon delivery</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {!isAccra && shippingData.region && !settings.deliveryUnavailable && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold block mb-1">Note for deliveries outside Accra:</span>
                    Full payment (Item + Delivery) is required before shipping.
                  </p>
                </div>
              </div>
            )}

            {/* Coupon */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Have a promo code?</h3>
              {couponApplied ? (
                <div className="flex items-center justify-between p-3 bg-gold-50 border border-gold-200 rounded-lg">
                  <div>
                    <p className="font-semibold text-gold-800 flex items-center gap-2">
                      <i className="ri-coupon-3-line"></i>
                      {couponApplied.code}
                    </p>
                    <p className="text-sm text-gold-600">
                      {couponApplied.type === 'percentage' ? `${couponApplied.value}% off` : `GH₵ ${couponApplied.value} off`}
                      {' '}&bull; Saving GH₵ {couponDiscount.toFixed(2)}
                    </p>
                  </div>
                  <button onClick={removeCoupon} className="text-red-500 hover:text-red-700 cursor-pointer p-1">
                    <i className="ri-close-circle-line text-xl"></i>
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 uppercase"
                      placeholder="Enter promo code"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      disabled={couponLoading || !couponCode.trim()}
                      className="px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                    >
                      {couponLoading ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                  {couponError && (
                    <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                      <i className="ri-error-warning-line"></i> {couponError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Loyalty Points */}
            {user && loyaltyPoints >= 15 && !couponApplied && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-start">
                  <div className="flex-1">
                    <h3 className="font-bold text-gold-900 flex items-center gap-2">
                      <i className="ri-award-line"></i> Loyalty Reward Available
                    </h3>
                    <p className="text-sm text-gold-700 mt-1">
                      You have <b>{loyaltyPoints} points</b> (1 point = GH₵ 1 discount).
                      {redeemPoints && <span className="block mt-1">Applying <b>GH₵ {pointsDiscount.toFixed(2)}</b> discount.</span>}
                    </p>
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer mt-1">
                    <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${redeemPoints ? 'bg-gold-500' : 'bg-gray-300'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${redeemPoints ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={redeemPoints}
                      onChange={(e) => setRedeemPoints(e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Delivery Notes */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Delivery Notes (Optional)</label>
              <textarea
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400"
                placeholder="Kindly note that not all requests can be accommodated"
                rows={3}
              ></textarea>
            </div>

            {/* Exchange & Refund Policy */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="p-5 bg-amber-50 rounded-lg border border-amber-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPolicy}
                    onChange={(e) => setAcceptedPolicy(e.target.checked)}
                    className="w-5 h-5 text-gold-600 rounded border-gray-300 focus:ring-gold-400 mt-0.5"
                  />
                  <div className="text-sm text-gray-900 font-medium">
                    I have read and agree to the <Link href="/policy" className="text-gold-600 underline hover:text-gold-700">Exchange & Refund Policy</Link>
                  </div>
                </label>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              onClick={handleProceedToPayment}
              disabled={isLoading || !acceptedPolicy || settings.deliveryUnavailable}
              className="w-full bg-gold-600 hover:bg-gold-700 text-white py-4 rounded-xl font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center text-lg shadow-lg"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin mr-2"></i>
                  Processing...
                </>
              ) : (
                <>
                  Proceed to Payment — GH₵ {payableNow.toFixed(2)}
                  <i className="ri-arrow-right-line ml-2"></i>
                </>
              )}
            </button>

          </div>

          <div className="lg:col-span-1">
            <OrderSummary
              items={cart}
              subtotal={subtotal}
              shipping={shippingCost}
              tax={tax}
              discount={totalDiscount}
              total={total}
              payableNow={payableNow}
              payLater={deliveryFeeToPayLater}
            />
          </div>
        </div>
      </div>

      {/* Payment Method Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center border-b border-gray-100">
              <div className="w-14 h-14 bg-gold-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-bank-card-line text-2xl text-gold-600"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Choose Payment Method</h3>
              <p className="text-sm text-gray-500 mt-1">How would you like to pay?</p>
            </div>

            <div className="p-6 space-y-3">
              {/* Pay by Card (Paystack) */}
              <button
                onClick={() => handlePlaceOrder('paystack')}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-gold-400 hover:bg-gold-50 transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
                  <i className="ri-bank-card-2-line text-2xl text-blue-600"></i>
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900">Pay by Card</p>
                  <p className="text-xs text-gray-500">Visa, Mastercard & more via Paystack</p>
                </div>
                <i className="ri-arrow-right-s-line text-xl text-gray-400 group-hover:text-gold-500 transition-colors"></i>
              </button>

              {/* Pay by MoMo (Moolre) */}
              <button
                onClick={() => handlePlaceOrder('moolre')}
                disabled={isLoading}
                className="w-full flex items-center gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-gold-400 hover:bg-gold-50 transition-all cursor-pointer group disabled:opacity-50"
              >
                <div className="w-12 h-12 bg-yellow-50 rounded-xl flex items-center justify-center group-hover:bg-yellow-100 transition-colors flex-shrink-0">
                  <i className="ri-smartphone-line text-2xl text-yellow-600"></i>
                </div>
                <div className="text-left flex-1">
                  <p className="font-bold text-gray-900">Pay by Mobile Money</p>
                  <p className="text-xs text-gray-500">MTN MoMo, Vodafone Cash & more</p>
                </div>
                <i className="ri-arrow-right-s-line text-xl text-gray-400 group-hover:text-gold-500 transition-colors"></i>
              </button>
            </div>

            <div className="px-6 pb-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="w-full py-3 border-2 border-gray-200 rounded-xl text-gray-600 font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div className="bg-gray-50 px-6 py-3 text-center">
              <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                <i className="ri-shield-check-line"></i>
                Your payment is secure and encrypted
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
