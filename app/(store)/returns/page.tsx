'use client';

import { useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ReturnsPortalPage() {
  const [step, setStep] = useState(1);
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [returnType, setReturnType] = useState<'exchange' | 'refund'>('exchange');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [foundOrder, setFoundOrder] = useState<any>(null);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [returnRequestId, setReturnRequestId] = useState('');

  const reasons = [
    'Wrong size / doesn\'t fit',
    'Wrong item received',
    'Faulty / defective item',
    'Item damaged on arrival',
    'Other (explain in notes)'
  ];

  const handleFindOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            product_name,
            variant_name,
            quantity,
            unit_price,
            total_price,
            metadata
          )
        `)
        .eq('order_number', orderNumber.trim())
        .eq('email', email.trim().toLowerCase())
        .single();

      if (orderError || !order) {
        setError('Order not found. Please check your order number and email address.');
        setIsLoading(false);
        return;
      }

      // Check if order is delivered (only delivered orders can be returned)
      if (order.status !== 'delivered') {
        setError(`This order is currently "${order.status}". Exchanges/returns can only be requested for delivered orders.`);
        setIsLoading(false);
        return;
      }

      // Check 24-hour delivery window
      const deliveredAt = new Date(order.updated_at);
      const now = new Date();
      const hoursSinceDelivery = (now.getTime() - deliveredAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceDelivery > 24) {
        setError('The 24-hour exchange window has passed for this order. Exchanges must be initiated within 24 hours of delivery. Please contact us on WhatsApp if you believe this is an error.');
        setIsLoading(false);
        return;
      }

      setFoundOrder(order);
      setStep(2);
    } catch (err) {
      console.error('Error finding order:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSubmitReturn = async () => {
    setIsLoading(true);
    try {
      // Create return request
      const { data: returnRequest, error: returnError } = await supabase
        .from('return_requests')
        .insert({
          order_id: foundOrder.id,
          user_id: foundOrder.user_id || null,
          status: 'pending',
          reason: returnType === 'exchange' ? 'Exchange request' : 'Refund request',
          description: additionalNotes || `${returnType} requested for ${selectedItems.length} item(s)`,
          refund_method: returnType === 'refund' ? 'original_payment' : null,
        })
        .select()
        .single();

      if (returnError) throw returnError;

      // Create return items
      const returnItems = selectedItems.map(itemId => {
        const orderItem = foundOrder.order_items.find((i: any) => i.id === itemId);
        return {
          return_request_id: returnRequest.id,
          order_item_id: itemId,
          quantity: orderItem?.quantity || 1,
          reason: returnReasons[itemId] || 'No reason provided',
          condition: 'unused'
        };
      });

      const { error: itemsError } = await supabase
        .from('return_items')
        .insert(returnItems);

      if (itemsError) throw itemsError;

      setReturnRequestId(returnRequest.id);
      setSubmitted(true);
      toast.success('Return request submitted successfully');

    } catch (err: any) {
      console.error('Error submitting return:', err);
      toast.error('Failed to submit return request: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen
  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="ri-checkbox-circle-fill text-4xl text-emerald-600"></i>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Request Submitted</h1>
            <p className="text-gray-600 mb-6">
              Your {returnType} request has been submitted successfully. Our team will review it and get back to you shortly.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 mb-8 text-left">
              <p className="text-sm text-gray-600"><strong>Order:</strong> {orderNumber}</p>
              <p className="text-sm text-gray-600"><strong>Request Type:</strong> {returnType === 'exchange' ? 'Exchange' : 'Refund'}</p>
              <p className="text-sm text-gray-600"><strong>Items:</strong> {selectedItems.length} item(s)</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-left">
              <h3 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                <i className="ri-information-line"></i> What happens next?
              </h3>
              <ul className="text-sm text-amber-800 space-y-2">
                <li>1. Our team will review your request within 24 hours</li>
                <li>2. You&apos;ll be contacted via WhatsApp or email with instructions</li>
                <li>3. Items must be returned unused, unworn, and in original packaging</li>
                {returnType === 'exchange' && (
                  <li>4. If you selected the size yourself, you&apos;ll be responsible for exchange delivery fees</li>
                )}
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/account" className="inline-flex items-center justify-center gap-2 bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-emerald-800 transition-colors">
                <i className="ri-user-line"></i>
                View My Orders
              </Link>
              <Link href="/shop" className="inline-flex items-center justify-center gap-2 border-2 border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:border-emerald-700 transition-colors">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Exchange & Returns Portal</h1>
        <p className="text-gray-600 mb-8">Request an exchange or return for a delivered order</p>

        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center flex-1">
                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                  i <= step ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? <i className="ri-check-line"></i> : i}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-1 mx-4 ${
                    i < step ? 'bg-emerald-700' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm font-semibold text-gray-900">Find Order</span>
            <span className="text-sm font-semibold text-gray-900">Select Items</span>
            <span className="text-sm font-semibold text-gray-900">Submit</span>
          </div>
        </div>

        {/* Step 1: Find Order */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Find Your Order</h2>
            <form onSubmit={handleFindOrder} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Order Number *</label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="e.g., ORD-1738940123456-123"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">Email Address *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="you@example.com"
                  required
                />
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
                  <i className="ri-error-warning-line mt-0.5"></i>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Finding Order...' : 'Find Order'}
              </button>
            </form>

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-xl text-amber-700 mt-0.5"></i>
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-2">Exchange & Return Policy</p>
                  <ul className="space-y-1">
                    <li>- Exchanges must be initiated within <strong>24 hours</strong> of delivery</li>
                    <li>- Applies to: faulty items, sizing issues, wrong items delivered</li>
                    <li>- <strong>No exchanges</strong> for heel height, style, or preference</li>
                    <li>- Items must be unused, unworn, with original packaging</li>
                    <li>- Refunds only if exchange is not possible (e.g., out of stock)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Select Items */}
        {step === 2 && foundOrder && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Items</h2>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Order <strong>{foundOrder.order_number}</strong> &bull; Delivered on {new Date(foundOrder.updated_at).toLocaleDateString()}
              </p>
            </div>

            <div className="space-y-4 mb-8">
              {foundOrder.order_items.map((item: any) => (
                <div key={item.id} className={`border-2 rounded-lg p-4 transition-colors ${
                  selectedItems.includes(item.id) ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200'
                }`}>
                  <div className="flex items-start space-x-4">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                      className="mt-1 w-5 h-5 text-emerald-700 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      {item.variant_name && <p className="text-sm text-gray-500">{item.variant_name}</p>}
                      <p className="text-sm text-gray-500">Qty: {item.quantity} &bull; GH₵ {item.unit_price?.toFixed(2)} each</p>

                      {selectedItems.includes(item.id) && (
                        <div className="mt-3">
                          <label className="block text-sm font-semibold text-gray-900 mb-1">Reason *</label>
                          <select
                            value={returnReasons[item.id] || ''}
                            onChange={(e) => setReturnReasons({ ...returnReasons, [item.id]: e.target.value })}
                            className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            required
                          >
                            <option value="">Select a reason</option>
                            {reasons.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                    <p className="font-bold text-gray-900">GH₵ {item.total_price?.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Exchange or Refund */}
            <div className="mb-8">
              <label className="block text-sm font-semibold text-gray-900 mb-3">What would you like? *</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setReturnType('exchange')}
                  className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
                    returnType === 'exchange' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <i className="ri-exchange-line text-2xl text-emerald-700 mb-2 block"></i>
                  <p className="font-semibold text-gray-900">Exchange</p>
                  <p className="text-xs text-gray-600 mt-1">Get a different size or replacement</p>
                </button>
                <button
                  type="button"
                  onClick={() => setReturnType('refund')}
                  className={`p-4 rounded-lg border-2 text-left transition-all cursor-pointer ${
                    returnType === 'refund' ? 'border-emerald-700 bg-emerald-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <i className="ri-refund-2-line text-2xl text-emerald-700 mb-2 block"></i>
                  <p className="font-semibold text-gray-900">Refund</p>
                  <p className="text-xs text-gray-600 mt-1">Only if exchange is not possible</p>
                </button>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-2">Additional Notes (Optional)</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Any additional details (preferred replacement size, description of defect, etc.)"
                rows={3}
              ></textarea>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => setStep(1)} className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors cursor-pointer">
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={selectedItems.length === 0 || !selectedItems.every(id => returnReasons[id])}
                className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                Review & Submit
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && foundOrder && (
          <div className="bg-white rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review & Submit</h2>

            <div className="mb-8 space-y-3">
              {foundOrder.order_items
                .filter((item: any) => selectedItems.includes(item.id))
                .map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      {item.variant_name && <p className="text-xs text-gray-500">{item.variant_name}</p>}
                      <p className="text-sm text-gray-600">Reason: {returnReasons[item.id]}</p>
                    </div>
                    <p className="font-bold text-gray-900">GH₵ {item.total_price?.toFixed(2)}</p>
                  </div>
                ))}
            </div>

            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Request type:</strong> {returnType === 'exchange' ? 'Exchange' : 'Refund'}
              </p>
              {additionalNotes && <p className="text-sm text-blue-800 mt-1"><strong>Notes:</strong> {additionalNotes}</p>}
            </div>

            <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">Reminders</h3>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>- Items must be unused, unworn, and in original packaging</li>
                <li>- Our team will contact you with next steps after review</li>
                {returnType === 'exchange' && (
                  <li>- If you selected the size yourself, exchange delivery fees apply</li>
                )}
                {returnType === 'refund' && (
                  <li>- Refunds are only approved if exchange is not possible (item out of stock)</li>
                )}
                <li>- Delivery fees are non-refundable once delivery is completed</li>
              </ul>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => setStep(2)} className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors cursor-pointer">
                Back
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={isLoading}
                className="flex-1 py-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
