'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import OrderSummary from '@/components/OrderSummary';
import { useCart } from '@/context/CartContext';
import { useCMS } from '@/context/CMSContext';
import { supabase } from '@/lib/supabase';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();
  const { getSetting } = useCMS();

  // "Contact us for a quote" fallback links — sourced from admin
  // settings so the merchant can update them in one place.
  const contactWhatsappNumber = (getSetting('whatsapp_number') || '233276558163').replace(/\D/g, '');
  const contactWhatsappUrl = contactWhatsappNumber
    ? `https://wa.me/${contactWhatsappNumber}`
    : '';
  const contactInstagramUrl = getSetting('social_instagram') || '';

  const [isLoading, setIsLoading] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'guest' | 'account'>('guest');
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
  const [selectedRegionType, setSelectedRegionType] = useState<string>('');
  const [accraZones, setAccraZones] = useState<any[]>([]);
  const [outsideZones, setOutsideZones] = useState<any[]>([]);

  const [areaSearch, setAreaSearch] = useState('');
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const areaDropdownRef = useRef<HTMLDivElement>(null);

  const filteredAccraZones = accraZones.filter(z =>
    z.name.toLowerCase().includes(areaSearch.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (areaDropdownRef.current && !areaDropdownRef.current.contains(e.target as Node)) {
        setShowAreaDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [paymentOption, setPaymentOption] = useState<'full_payment' | 'item_only'>('full_payment');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [showValidationBanner, setShowValidationBanner] = useState(false);
  const [errors, setErrors] = useState<any>({});

  // Auto-dismiss the top banner once the customer has resolved every issue,
  // so it doesn't linger after they fix things without re-clicking submit.
  useEffect(() => {
    if (!showValidationBanner) return;
    const stillHasErrors = Object.values(errors).some(Boolean) || (policyError && !acceptedPolicy);
    if (!stillHasErrors) setShowValidationBanner(false);
  }, [errors, acceptedPolicy, policyError, showValidationBanner]);
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
    sameDayDelivery: false,
    nextDayDelivery: false,
    deliveryUnavailable: false
  });

  const activeZone = regions.find(r => r.name === shippingData.region);
  const isAccra = selectedRegionType === 'greater_accra';

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
        .in('key', ['same_day_delivery_enabled', 'next_day_delivery_enabled', 'delivery_unavailable']);

      if (settingsData) {
        const sameDay = settingsData.find(s => s.key === 'same_day_delivery_enabled')?.value === true || settingsData.find(s => s.key === 'same_day_delivery_enabled')?.value === 'true';
        const nextDay = settingsData.find(s => s.key === 'next_day_delivery_enabled')?.value === true || settingsData.find(s => s.key === 'next_day_delivery_enabled')?.value === 'true';
        const unavailable = settingsData.find(s => s.key === 'delivery_unavailable')?.value === true || settingsData.find(s => s.key === 'delivery_unavailable')?.value === 'true';
        setSettings({ sameDayDelivery: sameDay, nextDayDelivery: nextDay, deliveryUnavailable: unavailable });
      }

      const { data: zonesData } = await supabase
        .from('delivery_zones')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (zonesData) {
        setRegions(zonesData);
        setAccraZones(zonesData.filter((z: any) => z.is_accra).sort((a: any, b: any) => a.name.localeCompare(b.name)));
        setOutsideZones(zonesData.filter((z: any) => !z.is_accra).sort((a: any, b: any) => a.name.localeCompare(b.name)));
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!isAccra && paymentOption === 'item_only') {
      setPaymentOption('full_payment');
    }
  }, [isAccra, paymentOption]);

  useEffect(() => {
    if (selectedRegionType === 'other_regions') {
      setShippingData(prev => ({ ...prev, region: '', city: '' }));
    }
  }, [selectedRegionType]);

  // Calculate Totals
  const subtotal = cartSubtotal;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const baseFee = activeZone?.base_fee || 0;
  const perItemFee = activeZone?.per_item_fee || 0;
  const outsideAccraTooManyItems = !isAccra && activeZone && totalItems >= 3;
  const zoneFee = isAccra
    ? baseFee
    : totalItems <= 1
      ? baseFee
      : totalItems === 2
        ? baseFee + perItemFee
        : 0;
  const shippingCost = zoneFee;

  const pointsDiscount = (redeemPoints && loyaltyPoints >= 15 && !couponApplied) ? Math.min(loyaltyPoints, subtotal) : 0;
  const totalDiscount = couponApplied ? couponDiscount : pointsDiscount;

  const tax = 0;
  const totalBeforeSplit = Math.max(0, subtotal + shippingCost + tax - totalDiscount);

  const deliveryFeeToPayLater = paymentOption === 'item_only' ? shippingCost : 0;
  const payableNow = Math.max(0, totalBeforeSplit - deliveryFeeToPayLater);
  const total = totalBeforeSplit;

  const validateShipping = () => {
    const newErrors: any = {};
    if (!shippingData.firstName) newErrors.firstName = 'First name is required';
    if (!shippingData.lastName) newErrors.lastName = 'Last name is required';
    if (!shippingData.phone) {
      newErrors.phone = 'Phone is required';
    } else {
      const cleanPhone = shippingData.phone.replace(/[\s\-()]/g, '');
      if (!/^(\+233|0)\d{9}$/.test(cleanPhone)) {
        newErrors.phone = 'Enter a valid Ghanaian phone number (e.g. 0241234567)';
      }
    }
    if (!selectedRegionType) newErrors.region = 'Region is required';
    if (selectedRegionType === 'greater_accra' && !shippingData.region) newErrors.region = 'Please select your delivery area';
    if (selectedRegionType === 'other_regions' && !shippingData.region) newErrors.region = 'Please select your city';

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
    const shippingOk = validateShipping();
    const policyMissing = !acceptedPolicy;
    if (policyMissing) setPolicyError(true);

    if (!shippingOk || policyMissing) {
      // Surface a top-of-form summary so the customer knows what to fix
      // without having to spot the red borders themselves.
      setShowValidationBanner(true);
      requestAnimationFrame(() => {
        // Prefer scrolling to the first shipping field with an error so the
        // customer's cursor naturally lands there; fall back to the policy
        // box if shipping is fine but the policy wasn't accepted.
        const firstShippingError = document.querySelector<HTMLElement>('[data-shipping-error="true"]');
        if (firstShippingError) {
          firstShippingError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstShippingError.querySelector<HTMLInputElement | HTMLSelectElement>('input, select, textarea')?.focus({ preventScroll: true });
          return;
        }
        if (policyMissing) {
          document.getElementById('policy-accept-box')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
      return;
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setShowValidationBanner(false);
    setShowPaymentModal(true);
  };

  const handlePlaceOrder = async (gateway: 'paystack' | 'moolre') => {
    setIsLoading(true);
    setShowPaymentModal(false);

    try {
      const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // `orders.email` is NOT NULL in the DB, but the checkout form makes
      // email optional. For guests who skip it, synthesise a placeholder so
      // the insert succeeds — receipts go via SMS in that case, and admins
      // can always reach the customer via the phone field.
      const cleanedPhoneForEmail = (shippingData.phone || '').replace(/\D/g, '') || 'unknown';
      const orderEmail =
        shippingData.email && shippingData.email.includes('@')
          ? shippingData.email
          : `guest-${cleanedPhoneForEmail}@hystepper.local`;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          order_number: orderNumber,
          user_id: user?.id || null,
          email: orderEmail,
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

      // Create Order Items — carry SKU + variant_id so warehouse / POS can pack
      // the right size/colour and admin order details show a fillable SKU.
      // IMPORTANT: variant_id MUST go in the column (not only metadata) so the
      // decrement_order_stock RPC can reduce the correct product_variants row
      // when payment confirms. Previously we only stored it in metadata, which
      // is why variant inventory never went down after a paid order.
      const orderItems = [
        ...cart.map(item => ({
          order_id: order.id,
          product_id: item.id,
          variant_id: item.variantId || null,
          product_name: item.name,
          variant_name: item.variant,
          sku: item.sku || null,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          metadata: {
            image: item.image,
            slug: item.slug,
            variant_id: item.variantId || null,
            // Persist picked options separately so admin order screens can
            // render Size / Colour as their own pills (legacy orders fall
            // back to parsing variant_name).
            size: item.size || null,
            color: item.color || null,
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

      // Order confirmation notifications (email + SMS) are fired from the
      // payment webhook / verify path once payment is actually confirmed.
      // Sending them here at order-creation time produced bogus "Hi Customer,
      // ... #undefined" messages for orders that never paid.

      // Handle Payment
      if (payableNow <= 0) {
        // Fully covered by points / coupon — nothing to charge online. Mark the
        // order as paid and decrement stock right away (no payment webhook will
        // fire for this path).
        await supabase
          .from('orders')
          .update({ payment_status: 'paid', status: 'processing' })
          .eq('id', order.id);

        const { error: stockError } = await supabase.rpc('decrement_order_stock', {
          order_ref: order.id,
        });
        if (stockError) {
          console.error('decrement_order_stock failed for', orderNumber, stockError);
        }

        clearCart();
        router.push(`/order-success?order=${orderNumber}`);
        return;
      }

      let redirectUrl = `/order-success?order=${orderNumber}`;

      if (gateway === 'moolre') {
        const paymentRes = await fetch('/api/payment/moolre', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderNumber,
            amount: payableNow,
            customerEmail: orderEmail,
          })
        });

        const paymentResult = await paymentRes.json();

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment initialization failed');
        }

        redirectUrl = paymentResult.url;
      } else if (gateway === 'paystack') {
        const paymentRes = await fetch('/api/payment/paystack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderNumber,
            amount: payableNow,
            customerEmail: orderEmail,
            customerPhone: shippingData.phone
          })
        });

        const paymentResult = await paymentRes.json();

        if (!paymentResult.success) {
          throw new Error(paymentResult.message || 'Payment initialization failed');
        }

        redirectUrl = paymentResult.url;
      }

      clearCart();
      window.location.href = redirectUrl;

    } catch (err: any) {
      console.error('Checkout error:', err);
      toast.error('Failed to place order: ' + err.message);
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

            {showValidationBanner && (Object.values(errors).some(Boolean) || (policyError && !acceptedPolicy)) && (
              <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
                <i className="ri-error-warning-line text-red-600 text-xl mt-0.5"></i>
                <div>
                  <p className="font-semibold text-red-700">Almost there — a few things still need your attention</p>
                  <p className="text-sm text-red-600 mt-0.5">
                    The fields highlighted in red below are missing or invalid. Fix them and tap <span className="font-semibold">Proceed to Payment</span> again.
                  </p>
                </div>
              </div>
            )}

            {/* Shipping Information */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-5">Shipping Information</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div data-shipping-error={errors.firstName ? 'true' : undefined} className="scroll-mt-24">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">First Name *</label>
                    <input
                      type="text"
                      value={shippingData.firstName}
                      onChange={(e) => { setShippingData({ ...shippingData, firstName: e.target.value }); setErrors((prev: any) => ({ ...prev, firstName: '' })); }}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.firstName ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="John"
                    />
                    {errors.firstName && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.firstName}</p>}
                  </div>
                  <div data-shipping-error={errors.lastName ? 'true' : undefined} className="scroll-mt-24">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Last Name *</label>
                    <input
                      type="text"
                      value={shippingData.lastName}
                      onChange={(e) => { setShippingData({ ...shippingData, lastName: e.target.value }); setErrors((prev: any) => ({ ...prev, lastName: '' })); }}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.lastName ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder="Doe"
                    />
                    {errors.lastName && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.lastName}</p>}
                  </div>
                </div>

                <div data-shipping-error={errors.email ? 'true' : undefined} className="scroll-mt-24">
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Email Address <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="email"
                    value={shippingData.email}
                    readOnly={!!user}
                    onChange={(e) => { setShippingData({ ...shippingData, email: e.target.value }); setErrors((prev: any) => ({ ...prev, email: '' })); }}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.email ? 'border-red-500' : 'border-gray-300'} ${user ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    placeholder="you@example.com"
                  />
                  {errors.email && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.email}</p>}
                </div>

                <div data-shipping-error={errors.phone ? 'true' : undefined} className="scroll-mt-24">
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Phone Number *</label>
                  <input
                    type="tel"
                    value={shippingData.phone}
                    onChange={(e) => { setShippingData({ ...shippingData, phone: e.target.value }); setErrors((prev: any) => ({ ...prev, phone: '' })); }}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="0241234567"
                  />
                  {errors.phone && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.phone}</p>}
                </div>


                <div data-shipping-error={errors.region && !selectedRegionType ? 'true' : undefined} className="scroll-mt-24">
                  <label className="block text-sm font-semibold text-gray-900 mb-1.5">Region *</label>
                  <select
                    value={selectedRegionType}
                    onChange={(e) => {
                      setSelectedRegionType(e.target.value);
                      setShippingData({ ...shippingData, region: '', city: '' });
                      setErrors((prev: any) => ({ ...prev, region: '', city: '' }));
                    }}
                    className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.region && !selectedRegionType ? 'border-red-500' : 'border-gray-300'} bg-white`}
                  >
                    <option value="">Select Region</option>
                    <option value="greater_accra">Greater Accra</option>
                    <option value="other_regions">Other Regions</option>
                  </select>
                  {errors.region && !selectedRegionType && <p className="text-sm text-red-600 mt-1 flex items-center gap-1"><i className="ri-error-warning-line"></i>{errors.region}</p>}
                </div>

                {selectedRegionType === 'greater_accra' && (
                  <div ref={areaDropdownRef} data-shipping-error={errors.region && selectedRegionType === 'greater_accra' ? 'true' : undefined} className="relative scroll-mt-24">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">Delivery Area *</label>
                    <div
                      className={`relative w-full border-2 rounded-lg overflow-hidden transition-colors ${errors.region ? 'border-red-500' : showAreaDropdown ? 'border-gold-400 ring-2 ring-gold-300' : 'border-gray-300'}`}
                    >
                      <div className="flex items-center">
                        <i className="ri-search-line text-gray-400 ml-3"></i>
                        <input
                          type="text"
                          value={shippingData.region ? `${shippingData.region} — GH₵${accraZones.find(z => z.name === shippingData.region)?.base_fee?.toFixed(0) || ''}` : areaSearch}
                          onChange={(e) => {
                            setAreaSearch(e.target.value);
                            setShippingData({ ...shippingData, region: '' });
                            setShowAreaDropdown(true);
                            setErrors((prev: any) => ({ ...prev, region: '' }));
                          }}
                          onFocus={() => {
                            if (shippingData.region) {
                              setAreaSearch('');
                              setShippingData({ ...shippingData, region: '' });
                            }
                            setShowAreaDropdown(true);
                          }}
                          className="w-full px-3 py-3 bg-white focus:outline-none"
                          placeholder="Type to search your area..."
                        />
                        {shippingData.region && (
                          <button
                            type="button"
                            onClick={() => {
                              setShippingData({ ...shippingData, region: '' });
                              setAreaSearch('');
                              setShowAreaDropdown(true);
                            }}
                            className="mr-3 text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            <i className="ri-close-line text-lg"></i>
                          </button>
                        )}
                      </div>
                    </div>

                    {showAreaDropdown && !shippingData.region && (
                      <div className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                        {filteredAccraZones.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500 text-center">
                            No areas match &ldquo;{areaSearch}&rdquo;
                          </div>
                        ) : (
                          filteredAccraZones.map(z => (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() => {
                                setShippingData({ ...shippingData, region: z.name });
                                setAreaSearch('');
                                setShowAreaDropdown(false);
                                setErrors((prev: any) => ({ ...prev, region: '' }));
                              }}
                              className="w-full text-left px-4 py-2.5 hover:bg-gold-50 transition-colors flex items-center justify-between cursor-pointer"
                            >
                              <span className="text-gray-900">{z.name}</span>
                              <span className="text-sm font-semibold text-gold-700">GH₵{z.base_fee.toFixed(0)}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {errors.region && <p className="text-sm text-red-600 mt-1">{errors.region}</p>}
                  </div>
                )}

                {selectedRegionType === 'other_regions' && (
                  <div data-shipping-error={errors.region && selectedRegionType === 'other_regions' ? 'true' : undefined} className="scroll-mt-24">
                    <label className="block text-sm font-semibold text-gray-900 mb-1.5">City *</label>
                    <select
                      value={shippingData.region}
                      onChange={(e) => { setShippingData({ ...shippingData, region: e.target.value }); setErrors((prev: any) => ({ ...prev, region: '' })); }}
                      className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-gold-300 focus:border-gold-400 ${errors.region ? 'border-red-500' : 'border-gray-300'} bg-white`}
                    >
                      <option value="">Select your city</option>
                      {outsideZones.map(z => (
                        <option key={z.id} value={z.name}>{z.name}</option>
                      ))}
                    </select>
                    {errors.region && <p className="text-sm text-red-600 mt-1">{errors.region}</p>}
                  </div>
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
                    {(settings.sameDayDelivery || settings.nextDayDelivery) && (
                      <div className={`mb-3 p-3 ${settings.sameDayDelivery ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'} border rounded-lg flex items-start gap-2`}>
                        <i className={`ri-information-line ${settings.sameDayDelivery ? 'text-emerald-600' : 'text-blue-600'} mt-0.5`}></i>
                        <p className={`text-sm ${settings.sameDayDelivery ? 'text-emerald-800' : 'text-blue-800'}`}>
                          {settings.sameDayDelivery
                            ? <><strong>Same-day delivery is active.</strong> Orders placed now will be delivered today.</>
                            : <><strong>Next-day delivery is active.</strong> All orders placed today will be delivered tomorrow.</>
                          }
                        </p>
                      </div>
                    )}

                    {outsideAccraTooManyItems ? (
                      <div className="p-5 bg-amber-50 border-2 border-amber-300 rounded-xl text-center">
                        <i className="ri-customer-service-2-line text-3xl text-amber-500 mb-2 block"></i>
                        <h3 className="text-lg font-bold text-amber-900 mb-1">Contact Us for Delivery Quote</h3>
                        <p className="text-sm text-amber-700 mb-3">
                          For 3 or more items outside Accra, delivery fees are quoted individually. Please reach out to us for a price.
                        </p>
                        <div className="flex items-center justify-center gap-4 text-sm font-semibold flex-wrap">
                          {contactWhatsappUrl && (
                            <a href={contactWhatsappUrl} target="_blank" rel="noopener noreferrer" className="text-green-700 hover:underline flex items-center gap-1">
                              <i className="ri-whatsapp-line"></i> WhatsApp
                            </a>
                          )}
                          {contactWhatsappUrl && contactInstagramUrl && (
                            <span className="text-gray-300">|</span>
                          )}
                          {contactInstagramUrl && (
                            <a href={contactInstagramUrl} target="_blank" rel="noopener noreferrer" className="text-pink-700 hover:underline flex items-center gap-1">
                              <i className="ri-instagram-line"></i> Instagram
                            </a>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-4 border-2 border-gold-300 bg-gold-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {settings.sameDayDelivery ? 'Same-Day Delivery' : settings.nextDayDelivery ? 'Next-Day Delivery' : 'Standard Delivery'}
                              </p>
                              <p className="text-sm text-gray-600">
                                {settings.sameDayDelivery
                                  ? 'Delivered today'
                                  : settings.nextDayDelivery
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
                              {totalItems === 2 && (
                                <span className="block mt-1 text-gray-500">
                                  Fee: GH₵ {baseFee.toFixed(2)} + GH₵ {perItemFee.toFixed(2)} (2nd item) = GH₵ {shippingCost.toFixed(2)}
                                </span>
                              )}
                            </p>
                          </div>
                        )}
                      </>
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
            <div id="policy-accept-box" className="bg-white rounded-xl shadow-sm p-6 scroll-mt-24">
              <div className={`p-5 rounded-lg border-2 transition-colors ${policyError && !acceptedPolicy ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'}`}>
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptedPolicy}
                    onChange={(e) => { setAcceptedPolicy(e.target.checked); if (e.target.checked) setPolicyError(false); }}
                    className="w-5 h-5 text-gold-600 rounded border-gray-300 focus:ring-gold-400 mt-0.5"
                  />
                  <div className={`text-sm font-medium ${policyError && !acceptedPolicy ? 'text-red-700' : 'text-gray-900'}`}>
                    I have read and agree to the <Link href="/policy" target="_blank" className="text-gold-600 underline hover:text-gold-700">Exchange & Refund Policy</Link>
                  </div>
                </label>
                {policyError && !acceptedPolicy && (
                  <p className="mt-2 ml-8 text-sm text-red-600 flex items-center gap-1">
                    <i className="ri-error-warning-line"></i>
                    Please tick this box to confirm you&apos;ve read the policy.
                  </p>
                )}
              </div>
            </div>

            {/* Place Order Button */}
            <button
              onClick={handleProceedToPayment}
              disabled={isLoading || !acceptedPolicy || settings.deliveryUnavailable || outsideAccraTooManyItems}
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
