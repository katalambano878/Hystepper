'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import FraudDetectionAlert from '@/components/FraudDetectionAlert';

interface OrderDetailClientProps {
  orderId: string;
}

type RiskLevel = 'low' | 'medium' | 'high';

interface FraudAnalysis {
  riskLevel: RiskLevel;
  reasons: string[];
}

export default function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  // NOTE: Manual "Mark as paid" intentionally disabled. We only trust Moolre's verify
  // endpoint to mark payments; see handleReconcile below.
  // const [markingPaid, setMarkingPaid] = useState(false);
  // const handleMarkPaid = async () => { ... };
  const [reconciling, setReconciling] = useState(false);

  const handleReconcile = async () => {
    if (!order) return;
    try {
      setReconciling(true);
      const res = await fetch('/api/payment/moolre/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: order.order_number }),
      });
      const payload = await res.json();

      if (payload.success && payload.payment_status === 'paid') {
        alert('Verified with Moolre — order marked as paid.');
      } else {
        alert(payload.message || 'Could not verify with Moolre yet. Try again in a moment.');
      }

      await fetchOrderDetails();
    } catch (err: any) {
      alert(err.message || 'Reconcile failed');
    } finally {
      setReconciling(false);
    }
  };

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      // Try to fetch by ID or order_number
      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            product_id,
            product_name,
            variant_name,
            sku,
            quantity,
            unit_price,
            total_price,
            metadata,
            products (
              product_images (url)
            )
          )
        `)
        .eq('id', orderId);

      let { data, error } = await query.single();

      if (error && error.code === 'PGRST116') {
        // Not found by ID, try order_number
        const { data: dataByNum, error: errorByNum } = await supabase
          .from('orders')
          .select(`
            *,
            order_items (
              id,
              product_id,
              product_name,
              variant_name,
              sku,
              quantity,
              unit_price,
              total_price,
              metadata,
              products (
                product_images (url)
              )
            )
          `)
          .eq('order_number', orderId)
          .single();

        if (dataByNum) {
          data = dataByNum;
          error = null;
        } else {
          error = errorByNum;
        }
      }

      if (error) throw error;
      setOrder(data);
      setTrackingNumber(data.metadata?.tracking_number || '');
      setAdminNotes(data.notes || '');

    } catch (err: any) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus?: string) => {
    try {
      setStatusUpdating(true);
      const statusToUpdate = newStatus || order.status;

      // Build update payload
      const updatePayload: any = {
        status: statusToUpdate,
        notes: adminNotes,
        metadata: {
          ...order.metadata,
          tracking_number: trackingNumber
        }
      };

      // If cancelling an order that was paid, auto-set payment_status to refunded
      if (statusToUpdate === 'cancelled' && order.payment_status === 'paid') {
        updatePayload.payment_status = 'refunded';
        updatePayload.cancel_reason = adminNotes || 'Cancelled by admin';
        updatePayload.metadata = {
          ...updatePayload.metadata,
          refund_initiated_at: new Date().toISOString(),
          refund_method: 'original_payment_method',
          refund_note: 'Refund to original payment method initiated on cancellation'
        };
      } else if (statusToUpdate === 'cancelled') {
        updatePayload.cancel_reason = adminNotes || 'Cancelled by admin';
      }

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (error) throw error;

      // Update local state
      setOrder({
        ...order,
        status: statusToUpdate,
        payment_status: updatePayload.payment_status || order.payment_status,
        notes: adminNotes,
        metadata: updatePayload.metadata
      });

      // Send Notification (Email + SMS)
      // Only send if status changed OR tracking number was added/changed
      const statusChanged = statusToUpdate !== order.status;
      const trackingChanged = trackingNumber !== order.metadata?.tracking_number;

      if (statusChanged || (trackingChanged && trackingNumber)) {
        fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'order_status',
            payload: {
              email: order.email,
              name: customerName,
              orderId: orderId, // This might be UUID, better use order.order_number if available
              orderNumber: order.order_number || orderId,
              status: statusToUpdate,
              trackingNumber: trackingNumber,
              phone: shippingAddress.phone || order.phone // Ensure phone is passed for SMS
            }
          })
        }).catch(err => console.error('Notification error:', err));
      }

      alert('Order updated successfully');
      setShowStatusMenu(false);
    } catch (err) {
      console.error('Error updating order:', err);
      alert('Failed to update order');
    } finally {
      setStatusUpdating(false);
    }
  };

  const statusOptions = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
  const statusColors: any = {
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'processing': 'bg-blue-100 text-blue-700 border-blue-200',
    'shipped': 'bg-purple-100 text-purple-700 border-purple-200',
    'delivered': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'awaiting_payment': 'bg-gray-100 text-gray-700 border-gray-200'
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (error || !order) return <div className="p-8 text-center text-red-500">{error || 'Order not found'}</div>;

  const currentStatus = order.status || 'pending';
  const shippingAddress = order.shipping_address || {};
  const customerName = shippingAddress.full_name || order.email.split('@')[0];

  // Derive timeline from status (simplified logic as we don't have full history table joined here yet)
  const timeline = [
    { status: 'Order Placed', date: new Date(order.created_at).toLocaleString(), completed: true },
    { status: 'Payment', date: order.payment_status, completed: order.payment_status === 'paid' },
    { status: 'Processing', date: '', completed: ['processing', 'shipped', 'delivered'].includes(order.status) },
    { status: 'Shipped', date: '', completed: ['shipped', 'delivered'].includes(order.status) },
    { status: 'Delivered', date: '', completed: order.status === 'delivered' }
  ];

  // Mock fraud analysis for now (or implement real logic later)
  const fraudAnalysis: FraudAnalysis = {
    riskLevel: 'low',
    reasons: []
  };

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {fraudAnalysis.riskLevel !== 'low' && (
              <FraudDetectionAlert
                riskLevel={fraudAnalysis.riskLevel}
                reasons={fraudAnalysis.reasons}
                orderId={orderId}
              />
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Order Items</h2>
                <span className="text-gray-600">{order.order_items?.length || 0} items</span>
              </div>

              <div className="space-y-4">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <div className="w-14 h-14 sm:w-20 sm:h-20 bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center relative shrink-0">
                      {item.products?.product_images?.[0]?.url ? (
                        <img
                          src={item.products.product_images[0].url}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <i className="ri-image-line text-2xl text-gray-300"></i>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1 text-sm sm:text-base truncate">{item.product_name}</h3>
                      <p className="text-sm text-gray-600 mb-1">{item.variant_name}</p>
                      <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-gray-900 mb-1 text-sm sm:text-base">GH₵ {item.unit_price?.toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>GH₵ {order.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Shipping</span>
                  <span>GH₵ {order.shipping_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>GH₵ {order.tax_total?.toFixed(2)}</span>
                </div>
                {order.discount_total > 0 && (
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Discount</span>
                    <span>-GH₵ {order.discount_total?.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
                  <span>Total</span>
                  <span>GH₵ {order.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Timeline</h2>
              <div className="space-y-4">
                {timeline.map((event, index) => (
                  <div key={index} className="flex items-start space-x-4">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 ${event.completed ? 'bg-emerald-700 border-emerald-700' : 'bg-white border-gray-300'
                      }`}>
                      {event.completed ? (
                        <i className="ri-check-line text-white text-xl"></i>
                      ) : (
                        <span className="w-3 h-3 bg-gray-300 rounded-full"></span>
                      )}
                    </div>
                    <div className="flex-1 pb-6 border-b border-gray-200 last:border-0">
                      <p className={`font-semibold ${event.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                        {event.status}
                      </p>
                      {event.date && (
                        <p className="text-sm text-gray-600 mt-1">{event.date}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Status</h2>
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  className={`w-full px-4 py-3 rounded-lg border-2 font-semibold text-left flex items-center justify-between ${statusColors[currentStatus] || 'bg-gray-100'}`}
                >
                  <span className="capitalize">{currentStatus}</span>
                  <i className="ri-arrow-down-s-line text-xl"></i>
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          if (status === 'cancelled' && order.payment_status === 'paid') {
                            if (confirm('This order has been paid. Cancelling will automatically initiate a refund to the original payment method. Continue?')) {
                              handleUpdateStatus(status);
                            }
                          } else {
                            handleUpdateStatus(status);
                          }
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors capitalize ${status === currentStatus ? 'bg-emerald-50 font-semibold' : ''
                          } ${status === 'cancelled' ? 'text-red-600 hover:bg-red-50' : ''}`}
                      >
                        {status}
                        {status === 'cancelled' && order.payment_status === 'paid' && (
                          <span className="text-xs text-red-400 ml-2">(will trigger refund)</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Refund indicator */}
                {order.payment_status === 'refunded' && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
                    <i className="ri-refund-2-line text-blue-600 mt-0.5"></i>
                    <div className="text-sm">
                      <p className="font-semibold text-blue-900">Refund Initiated</p>
                      <p className="text-blue-700">
                        Refund to original payment method.
                        {order.metadata?.refund_initiated_at && (
                          <span className="block text-xs text-blue-500 mt-1">
                            Initiated: {new Date(order.metadata.refund_initiated_at).toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              <button
                onClick={() => handleUpdateStatus()}
                disabled={statusUpdating}
                className="w-full mt-4 bg-emerald-700 hover:bg-emerald-800 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {statusUpdating ? 'Updating...' : 'Update Status'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Customer</h2>
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-100 text-emerald-700 rounded-full font-semibold uppercase">
                  {customerName.substring(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{customerName}</p>
                  <p className="text-sm text-gray-600">{order.email}</p>
                  <p className="text-sm text-gray-600">{shippingAddress.phone || order.phone}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                {order.metadata?.pos_sale && order.metadata?.pos_order_type !== 'delivery'
                  ? 'Pickup / In-store'
                  : 'Shipping Address'}
              </h2>
              {order.metadata?.pos_sale && order.metadata?.pos_order_type !== 'delivery' ? (
                <div className="flex items-start gap-2 text-gray-700">
                  <i className="ri-store-3-line text-indigo-600 text-lg mt-0.5"></i>
                  <div>
                    <p className="font-semibold">Walk-in POS Sale</p>
                    <p className="text-sm text-gray-500">
                      Customer collected the items in-store. No delivery required.
                    </p>
                    {shippingAddress.note && (
                      <p className="text-xs text-gray-400 mt-1">{shippingAddress.note}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-gray-700 space-y-1">
                  {shippingAddress.address_line1 && <p>{shippingAddress.address_line1}</p>}
                  {shippingAddress.address_line2 && <p>{shippingAddress.address_line2}</p>}
                  {(shippingAddress.city || shippingAddress.state) && (
                    <p>
                      {[shippingAddress.city, shippingAddress.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {shippingAddress.postal_code && <p>{shippingAddress.postal_code}</p>}
                  {shippingAddress.country && (
                    <p className="font-semibold">{shippingAddress.country}</p>
                  )}
                  {shippingAddress.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">
                        Delivery Notes
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {shippingAddress.notes}
                      </p>
                    </div>
                  )}
                  {!shippingAddress.address_line1 &&
                    !shippingAddress.city &&
                    !shippingAddress.state && (
                      <p className="text-sm text-gray-400 italic">
                        No shipping address on file.
                      </p>
                    )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Info</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Method</span>
                  <span className="font-semibold text-gray-900 capitalize">{order.payment_method}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap capitalize ${
                      order.payment_status === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : order.payment_status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : order.payment_status === 'refunded'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {order.payment_status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction</span>
                  <span className="text-sm text-gray-900 font-mono truncate max-w-[150px]">
                    {order.metadata?.moolre_reference || order.payment_transaction_id || 'N/A'}
                  </span>
                </div>
              </div>

              {order.payment_method === 'moolre' &&
                order.payment_status !== 'paid' &&
                order.payment_status !== 'refunded' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={handleReconcile}
                      disabled={reconciling}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 hover:bg-black text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {reconciling ? (
                        <>
                          <i className="ri-loader-4-line animate-spin" />
                          Checking with Moolre…
                        </>
                      ) : (
                        <>
                          <i className="ri-refresh-line" />
                          Reconcile with Moolre
                        </>
                      )}
                    </button>
                    <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                      Re-checks this transaction against Moolre. Marks the order paid only
                      if Moolre confirms the payment.
                    </p>
                  </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Admin Notes</h2>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this order..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              />
              <button
                onClick={() => handleUpdateStatus()}
                disabled={statusUpdating}
                className="w-full mt-3 bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
