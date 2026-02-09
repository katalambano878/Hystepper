'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutSteps from '@/components/CheckoutSteps';
import OrderSummary from '@/components/OrderSummary';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';

// Regions are now loaded dynamically from delivery_zones table

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
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
    postalCode: ''
  });

  const [regions, setRegions] = useState<any[]>([]);

  const [deliveryMethod, setDeliveryMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('moolre'); // Gateway: moolre | paystack
  const [paymentOption, setPaymentOption] = useState<'full_payment' | 'item_only'>('full_payment');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [errors, setErrors] = useState<any>({});

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

  // Dynamic zone lookup
  const activeZone = regions.find(r => r.name === shippingData.region);
  const isAccra = activeZone?.is_accra || false;

  // Check auth and cart and settings
  useEffect(() => {
    async function init() {
      // 1. Auth
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setCheckoutType('account');
        setShippingData(prev => ({ ...prev, email: session.user.email || '' }));

        // Fetch Points
        const { data: pointsData } = await supabase
          .from('loyalty_points')
          .select('points')
          .eq('user_id', session.user.id)
          .single();

        if (pointsData) {
          setLoyaltyPoints(pointsData.points || 0);
        }
      }

      // 2. Settings
      const { data: settingsData } = await supabase
        .from('store_settings')
        .select('key, value')
        .in('key', ['next_day_delivery_enabled', 'delivery_unavailable']);

      if (settingsData) {
        const nextDay = settingsData.find(s => s.key === 'next_day_delivery_enabled')?.value === true || settingsData.find(s => s.key === 'next_day_delivery_enabled')?.value === 'true';
        const unavailable = settingsData.find(s => s.key === 'delivery_unavailable')?.value === true || settingsData.find(s => s.key === 'delivery_unavailable')?.value === 'true';
        setSettings({ nextDayDelivery: nextDay, deliveryUnavailable: unavailable });
      }

      // 3. Delivery Zones
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

  // Effect to reset payment option if region changes
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
  // Outside Accra: base_fee + (per_item_fee x number_of_items)
  // Inside Accra: base_fee only (flat rate)
  const zoneFee = isAccra ? baseFee : baseFee + (perItemFee * totalItems);
  const shippingCost = zoneFee;

  // Loyalty Discount Logic: 1 point = GH₵ 1 discount, minimum 15 points to redeem
  // Cannot combine with coupon/promo discounts
  const pointsDiscount = (redeemPoints && loyaltyPoints >= 15 && !couponApplied) ? Math.min(loyaltyPoints, subtotal) : 0;

  // Total discount (coupon OR points, never both)
  const totalDiscount = couponApplied ? couponDiscount : pointsDiscount;

  const tax = 0;
  const totalBeforeSplit = subtotal + shippingCost + tax - totalDiscount;

  const deliveryFeeToPayLater = paymentOption === 'item_only' ? shippingCost : 0;
  const payableNow = totalBeforeSplit - deliveryFeeToPayLater;

  const total = totalBeforeSplit; // Display total is final amount user owes (conceptually)

  const validateShipping = () => {
    const newErrors: any = {};
    if (!shippingData.firstName) newErrors.firstName = 'First name is required';
    if (!shippingData.lastName) newErrors.lastName = 'Last name is required';
    if (!shippingData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(shippingData.email)) newErrors.email = 'Invalid email';
    if (!shippingData.phone) newErrors.phone = 'Phone is required';
    if (!shippingData.address) newErrors.address = 'Address is required';
    if (!shippingData.city) newErrors.city = 'City is required';
    if (!shippingData.region) newErrors.region = 'Region is required';

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

      // Check dates
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

      // Check usage limit
      if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
        setCouponError('This coupon has reached its usage limit');
        setCouponLoading(false);
        return;
      }

      // Check minimum purchase
      if (coupon.minimum_purchase && subtotal < coupon.minimum_purchase) {
        setCouponError(`Minimum purchase of GH₵ ${coupon.minimum_purchase} required`);
        setCouponLoading(false);
        return;
      }

      // Cannot combine with loyalty points
      if (redeemPoints) {
        setRedeemPoints(false);
      }

      // Calculate discount
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

  const handleContinueToDelivery = () => {
    if (validateShipping()) {
      setCurrentStep(2);
    }
  };

  const handleContinueToPayment = () => {
    setCurrentStep(3);
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }
    if (!acceptedPolicy) {
      alert('Please accept the Exchange & Refund Policy to proceed.');
      return;
    }

    setIsLoading(true);

    try {
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // 1. Create Order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          user_id: user?.id || null,
          email: shippingData.email,
          phone: shippingData.phone,
          status: 'pending',
          payment_status: 'pending',
          currency: 'GHS',
          subtotal: subtotal,
          tax_total: tax,
          shipping_total: shippingCost,
          discount_total: totalDiscount,
          total: total,
          shipping_method: deliveryMethod,
          payment_method: paymentMethod,
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

      // 2. Create Order Items
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

      // 3. Send order confirmation notification
      try {
        await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order_confirmation',
            payload: {
              email: shippingData.email,
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
        // Don't block order flow if notification fails
      }

      // 4. Handle Payment Redirects
      if (paymentMethod === 'moolre') {
        try {
          // Logic for 0 payable flow (e.g. fully covered by discount, unlikely but possible)
          if (payableNow <= 0) {
            clearCart();
            router.push(`/order-success?order=${orderNumber}`);
            return;
          }

          const paymentRes = await fetch('/api/payment/moolre', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: orderNumber,
              amount: payableNow, // Pay only what is due now
              customerEmail: shippingData.email
            })
          });

          const paymentResult = await paymentRes.json();

          if (!paymentResult.success) {
            throw new Error(paymentResult.message || 'Payment initialization failed');
          }

          clearCart();
          window.location.href = paymentResult.url;
          return;

        } catch (paymentErr: any) {
          console.error('Payment Error:', paymentErr);
          alert('Failed to initialize payment: ' + paymentErr.message);
          setIsLoading(false);
          return;
        }
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
          <Link href="/shop" className="inline-block bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold hover:bg-emerald-800 transition-colors">
            Return to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <Link href="/cart" className="text-gray-600 hover:text-gray-900 font-medium inline-flex items-center whitespace-nowrap">
            <i className="ri-arrow-left-line mr-2"></i>
            Back to Cart
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        {currentStep === 1 && (
          <div className="mb-8 bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Checkout As</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <button
                onClick={() => !user && setCheckoutType('guest')}
                className={`p-6 rounded-xl border-2 transition-all text-left cursor-pointer ${checkoutType === 'guest'
                  ? 'border-emerald-700 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
                  } ${user ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!!user}
              >
                <div className="flex items-center justify-between mb-3">
                  <i className="ri-user-line text-3xl text-emerald-700"></i>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checkoutType === 'guest' ? 'border-emerald-700 bg-emerald-700' : 'border-gray-300'
                    }`}>
                    {checkoutType === 'guest' && <i className="ri-check-line text-white text-sm"></i>}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Guest Checkout</h3>
                <p className="text-sm text-gray-600">Quick checkout without creating an account</p>
                {user && <p className="text-xs text-emerald-600 mt-2">You are logged in</p>}
              </button>

              <button
                onClick={() => setCheckoutType('account')}
                className={`p-6 rounded-xl border-2 transition-all text-left cursor-pointer ${checkoutType === 'account'
                  ? 'border-emerald-700 bg-emerald-50'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <i className="ri-account-circle-line text-3xl text-emerald-700"></i>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${checkoutType === 'account' ? 'border-emerald-700 bg-emerald-700' : 'border-gray-300'
                    }`}>
                    {checkoutType === 'account' && <i className="ri-check-line text-white text-sm"></i>}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{user ? 'My Account' : 'Create Account'}</h3>
                <p className="text-sm text-gray-600">
                  {user ? `Logged in as ${user.email}` : 'Save info, track orders & earn loyalty points'}
                </p>
              </button>
            </div>
          </div>
        )}

        <CheckoutSteps currentStep={currentStep} />

        <div className="grid lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            {currentStep === 1 && (
              <>
                <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-6">Shipping Information</h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">First Name *</label>
                        <input
                          type="text"
                          value={shippingData.firstName}
                          onChange={(e) => setShippingData({ ...shippingData, firstName: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="John"
                        />
                        {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Last Name *</label>
                        <input
                          type="text"
                          value={shippingData.lastName}
                          onChange={(e) => setShippingData({ ...shippingData, lastName: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="Doe"
                        />
                        {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Email Address *</label>
                      <input
                        type="email"
                        value={shippingData.email}
                        readOnly={!!user}
                        onChange={(e) => setShippingData({ ...shippingData, email: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.email ? 'border-red-500' : 'border-gray-300'} ${user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        placeholder="you@example.com"
                      />
                      {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Phone Number *</label>
                      <input
                        type="tel"
                        value={shippingData.phone}
                        onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="+233 XX XXX XXXX"
                      />
                      {errors.phone && <p className="text-sm text-red-600 mt-1">{errors.phone}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Street Address *</label>
                      <input
                        type="text"
                        value={shippingData.address}
                        onChange={(e) => setShippingData({ ...shippingData, address: e.target.value })}
                        className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.address ? 'border-red-500' : 'border-gray-300'}`}
                        placeholder="House number and street name"
                      />
                      {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">City *</label>
                        <input
                          type="text"
                          value={shippingData.city}
                          onChange={(e) => setShippingData({ ...shippingData, city: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.city ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="Accra"
                        />
                        {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">Region *</label>
                        <select
                          value={shippingData.region}
                          onChange={(e) => setShippingData({ ...shippingData, region: e.target.value })}
                          className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${errors.region ? 'border-red-500' : 'border-gray-300'} bg-white`}
                        >
                          <option value="">Select Region</option>
                          {regions.map(r => (
                            <option key={r.id} value={r.name}>{r.name}</option>
                          ))}
                        </select>
                        {errors.region && <p className="text-sm text-red-600 mt-1">{errors.region}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">Postal Code</label>
                      <input
                        type="text"
                        value={shippingData.postalCode}
                        onChange={(e) => setShippingData({ ...shippingData, postalCode: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        placeholder="Optional"
                      />
                    </div>

                    {checkoutType === 'account' && (
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={saveAddress}
                          onChange={(e) => setSaveAddress(e.target.checked)}
                          className="w-5 h-5 text-emerald-700 rounded border-gray-300 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-gray-700">Save this address for future orders</span>
                      </label>
                    )}
                  </div>

                  <button
                    onClick={handleContinueToDelivery}
                    className="w-full mt-6 bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Continue to Delivery
                  </button>
                </div>
              </>
            )}

            {currentStep === 2 && (
              <>
                {settings.deliveryUnavailable ? (
                  <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center">
                      <i className="ri-truck-line text-4xl text-red-400 mb-3 block"></i>
                      <h2 className="text-xl font-bold text-red-900 mb-2">Delivery Unavailable Today</h2>
                      <p className="text-red-700 mb-4">We are not dispatching deliveries at this time. Please check back later or contact us on WhatsApp/Instagram for updates.</p>
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="px-6 py-3 border-2 border-gray-300 hover:border-gray-400 text-gray-700 rounded-lg font-semibold transition-colors cursor-pointer"
                      >
                        Back
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-6">Delivery Method</h2>

                    {settings.nextDayDelivery && (
                      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                        <i className="ri-information-line text-blue-600 mt-0.5"></i>
                        <p className="text-sm text-blue-800">
                          <strong>Next-day delivery is currently active.</strong> All orders placed today will be delivered tomorrow.
                        </p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors border-emerald-700 bg-emerald-50`}>
                        <div className="flex items-center space-x-4">
                          <input
                            type="radio"
                            name="delivery"
                            value="standard"
                            checked={true}
                            readOnly
                            className="w-5 h-5 text-emerald-700"
                          />
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
                        </div>
                        <p className="font-bold text-gray-900">GH₵ {shippingCost.toFixed(2)}</p>
                      </label>
                    </div>

                    {/* Transport service info for outside Accra */}
                    {!isAccra && activeZone?.transport_service && (
                      <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg flex items-start gap-2">
                        <i className="ri-bus-line text-gray-600 mt-0.5"></i>
                        <p className="text-sm text-gray-700">
                          Delivery to <strong>{activeZone.name}</strong> via <strong>{activeZone.transport_service}</strong> transport service.
                          {perItemFee > 0 && (
                            <span className="block mt-1 text-gray-500">
                              Fee breakdown: GH₵ {baseFee.toFixed(2)} base + GH₵ {perItemFee.toFixed(2)} × {totalItems} item{totalItems !== 1 ? 's' : ''} = GH₵ {shippingCost.toFixed(2)}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {/* Contact for unlisted locations */}
                    <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <i className="ri-map-pin-line text-amber-600 mt-0.5"></i>
                      <p className="text-sm text-amber-800">
                        Don&apos;t see your location? Contact us on <strong>WhatsApp</strong> or <strong>Instagram</strong> and we&apos;ll arrange delivery for you.
                      </p>
                    </div>

                    <div className="flex flex-col-reverse md:flex-row gap-4 mt-6">
                      <button
                        onClick={() => setCurrentStep(1)}
                        className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleContinueToPayment}
                        className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Continue to Payment
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {currentStep === 3 && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-6">Payment Options</h2>

                {/* 1. Payment Breakdown / Option Select */}
                <div className="mb-8 space-y-4">
                  <h3 className="font-semibold text-gray-900">How would you like to pay?</h3>

                  {isAccra ? (
                    <>
                      <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentOption === 'full_payment' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          name="payment_option"
                          value="full_payment"
                          checked={paymentOption === 'full_payment'}
                          onChange={() => setPaymentOption('full_payment')}
                          className="w-5 h-5 text-emerald-700 mt-0.5 mr-3"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">Pay Full Amount Now</p>
                          <p className="text-sm text-gray-600">Item cost + Delivery Fee</p>
                        </div>
                      </label>
                      <label className={`flex items-start p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentOption === 'item_only' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-200'}`}>
                        <input
                          type="radio"
                          name="payment_option"
                          value="item_only"
                          checked={paymentOption === 'item_only'}
                          onChange={() => setPaymentOption('item_only')}
                          className="w-5 h-5 text-emerald-700 mt-0.5 mr-3"
                        />
                        <div>
                          <p className="font-semibold text-gray-900">Pay Item Cost Only</p>
                          <p className="text-sm text-gray-600">Pay delivery fee upon delivery</p>
                        </div>
                      </label>
                    </>
                  ) : (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-semibold block mb-1">Note for deliveries outside Accra:</span>
                        Full payment (Item + Delivery) is required before shipping.
                      </p>
                    </div>
                  )}
                </div>

                {/* Coupon Code */}
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3">Have a promo code?</h3>
                  {couponApplied ? (
                    <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div>
                        <p className="font-semibold text-emerald-800 flex items-center gap-2">
                          <i className="ri-coupon-3-line"></i>
                          {couponApplied.code}
                        </p>
                        <p className="text-sm text-emerald-600">
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
                          className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 uppercase"
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

                {/* Loyalty Points Section */}
                {user && loyaltyPoints >= 15 && !couponApplied && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-1">
                        <h3 className="font-bold text-emerald-900 flex items-center gap-2">
                          <i className="ri-award-line"></i> Loyalty Reward Available
                        </h3>
                        <p className="text-sm text-emerald-700 mt-1">
                          You have <b>{loyaltyPoints} points</b> (1 point = GH₵ 1 discount).
                          {redeemPoints && <span className="block mt-1">Applying <b>GH₵ {pointsDiscount.toFixed(2)}</b> discount.</span>}
                        </p>
                        <p className="text-xs text-emerald-600 mt-1">
                          Points earned: 5 per item on delivered orders. Points expire 6 months after earning.
                          Cannot be combined with coupon/promo codes.
                        </p>
                      </div>
                      <label className="flex items-center space-x-2 cursor-pointer mt-1">
                        <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out ${redeemPoints ? 'bg-emerald-600' : 'bg-gray-300'}`}>
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

                <div className="border-t border-gray-100 my-6 pt-4"></div>

                <h2 className="text-xl font-bold text-gray-900 mb-6">Select Payment Gateway</h2>
                <div className="space-y-4 mb-8">
                  <label className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-colors ${paymentMethod === 'moolre' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-300 hover:border-gray-400'}`}>
                    <div className="flex items-center space-x-4">
                      <input
                        type="radio"
                        name="payment"
                        value="moolre"
                        checked={paymentMethod === 'moolre'}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-5 h-5 text-emerald-700"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">Moolre Payment</p>
                        <p className="text-sm text-gray-600">Mobile money & card payments</p>
                      </div>
                    </div>
                    <i className="ri-smartphone-line text-2xl text-emerald-700"></i>
                  </label>
                </div>

                {/* Delivery Notes */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">Delivery Notes (Optional)</label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="Any special instructions for delivery..."
                    rows={3}
                  ></textarea>
                  <p className="text-xs text-gray-500 mt-1">Note: Not all notes or requests can be accommodated. You may be contacted if a request cannot be fulfilled.</p>
                </div>

                {/* Exchange & Refund Policy Summary */}
                <div className="mb-6 p-5 bg-amber-50 rounded-lg border border-amber-200">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <i className="ri-error-warning-line text-amber-600"></i>
                    Exchange & Refund Summary (Please Read):
                  </h3>
                  <ul className="text-sm text-gray-700 space-y-2 mb-4">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Exchanges must be initiated within <strong>24 hours</strong> of delivery</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Exchanges apply to faulty items, sizing issues, or wrong items delivered</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>No exchanges for heel height, style, or product preference, as these are stated before purchase</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Refunds apply for faulty or wrong items delivered only if an exchange is not possible</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Delivery fees are non-refundable once delivery is completed or once the rider has been directed to your location</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Customers are responsible for delivery fees for exchanges when exchanging a size they personally selected</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-amber-600 mt-0.5">•</span>
                      <span>Items must be unused, unworn, and returned with all original packaging intact</span>
                    </li>
                  </ul>
                  <label className="flex items-start space-x-3 cursor-pointer pt-3 border-t border-amber-200">
                    <input
                      type="checkbox"
                      checked={acceptedPolicy}
                      onChange={(e) => setAcceptedPolicy(e.target.checked)}
                      className="w-5 h-5 text-emerald-700 rounded border-gray-300 focus:ring-emerald-500 mt-0.5"
                    />
                    <div className="text-sm text-gray-900 font-medium">
                      I have read and agree to the <Link href="/policy" className="text-emerald-700 underline hover:text-emerald-800">Exchange & Refund Policy</Link>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col-reverse md:flex-row gap-4 mt-6">
                  <button
                    onClick={() => setCurrentStep(2)}
                    className="flex-1 border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isLoading || !acceptedPolicy}
                    className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer flex items-center justify-center"
                  >
                    {isLoading ? (
                      <>
                        <i className="ri-loader-4-line animate-spin mr-2"></i>
                        Processing...
                      </>
                    ) : (
                      'Place Order'
                    )}
                  </button>
                </div>
              </div>
            )}
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
    </main>
  );
}
