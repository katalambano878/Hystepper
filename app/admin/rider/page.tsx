'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface OrderItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  metadata?: { image?: string };
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  subtotal: number;
  shipping_total: number;
  created_at: string;
  assigned_at: string | null;
  rider_notes: string | null;
  phone: string | null;
  email: string | null;
  shipping_address: any;
  payment_method: string | null;
  delivery_notes: string | null;
  order_items: OrderItem[];
}

const STATUS_COLORS: Record<string, string> = {
  pending:    'bg-amber-100 text-amber-700 border-amber-200',
  processing: 'bg-blue-100 text-blue-700 border-blue-200',
  shipped:    'bg-purple-100 text-purple-700 border-purple-200',
  delivered:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  completed:  'bg-emerald-100 text-emerald-700 border-emerald-200',
  cancelled:  'bg-red-100 text-red-700 border-red-200',
};

export default function RiderPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [riderName, setRiderName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [tab, setTab] = useState<'active' | 'done'>('active');
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    // Fetch staff name
    const { data: staffRow } = await supabase
      .from('staff')
      .select('full_name')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (staffRow) setRiderName(staffRow.full_name);

    // Load only orders assigned to this rider — one query, no staff-table loop
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, total, subtotal, shipping_total,
        created_at, assigned_at, rider_notes, phone, email,
        shipping_address, payment_method, delivery_notes,
        order_items (
          id, product_name, variant_name,
          quantity, unit_price, total_price, metadata
        )
      `)
      .eq('rider_id', session.user.id)
      .order('assigned_at', { ascending: false });

    if (!error) setOrders(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateStatus = async (orderId: string, status: 'delivered' | 'completed') => {
    setUpdating(orderId);
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      showToast(`Order marked as ${status}`);
    }
    setUpdating(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-GH', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getAddress = (o: Order) => {
    const a = o.shipping_address;
    if (!a) return null;
    return [a.address, a.deliveryArea, a.city, a.region]
      .filter(Boolean).join(', ');
  };

  const getCustomerName = (o: Order) => {
    const a = o.shipping_address;
    if (a?.full_name) return a.full_name;
    if (a?.firstName || a?.lastName) return `${a.firstName || ''} ${a.lastName || ''}`.trim();
    return 'Guest';
  };

  const activeOrders = orders.filter(o => !['delivered', 'completed', 'cancelled'].includes(o.status));
  const doneOrders   = orders.filter(o => ['delivered', 'completed'].includes(o.status));
  const displayed    = tab === 'active' ? activeOrders : doneOrders;

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2">
          <i className="ri-check-line text-base"></i> {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center text-2xl">🛵</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {riderName ? `Hi, ${riderName.split(' ')[0]} 👋` : 'My Deliveries'}
            </h1>
            <p className="text-sm text-gray-500">Orders assigned to you</p>
          </div>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <i className="ri-refresh-line"></i> Refresh
        </button>
      </div>

      {/* Stat tabs */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setTab('active')}
          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            tab === 'active'
              ? 'border-sky-400 bg-sky-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${tab === 'active' ? 'bg-sky-100' : 'bg-gray-100'}`}>
            <i className={`ri-truck-line text-xl ${tab === 'active' ? 'text-sky-600' : 'text-gray-400'}`}></i>
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '—' : activeOrders.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Active Deliveries</p>
        </button>
        <button
          onClick={() => setTab('done')}
          className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
            tab === 'done'
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${tab === 'done' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
            <i className={`ri-checkbox-circle-line text-xl ${tab === 'done' ? 'text-emerald-600' : 'text-gray-400'}`}></i>
          </div>
          <p className="text-3xl font-bold text-gray-900">{loading ? '—' : doneOrders.length}</p>
          <p className="text-sm text-gray-500 mt-0.5">Completed Today</p>
        </button>
      </div>

      {/* Order list */}
      {loading ? (
        <div className="bg-white border border-gray-200 rounded-2xl flex items-center justify-center py-20 text-gray-400">
          <i className="ri-loader-4-line animate-spin text-3xl mr-3"></i>
          Loading your deliveries…
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl py-20 text-center text-gray-400">
          <i className={`${tab === 'active' ? 'ri-inbox-line' : 'ri-check-double-line text-emerald-400'} text-5xl mb-3 block`}></i>
          <p className="font-medium text-gray-600">
            {tab === 'active' ? 'No active deliveries' : 'No completed deliveries yet'}
          </p>
          <p className="text-sm mt-1">
            {tab === 'active' ? 'New orders will appear here once assigned by admin' : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(order => {
            const isExpanded = expandedId === order.id;
            const isDone = ['delivered', 'completed'].includes(order.status);
            const address = getAddress(order);

            return (
              <div
                key={order.id}
                className={`bg-white border-2 rounded-2xl overflow-hidden transition-all ${
                  isDone
                    ? 'border-emerald-100'
                    : isExpanded
                      ? 'border-sky-300 shadow-md shadow-sky-100'
                      : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Card header — always visible */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="w-full text-left px-5 py-4 flex items-center gap-4 cursor-pointer"
                >
                  {/* Status dot */}
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    isDone ? 'bg-emerald-500' : 'bg-sky-500 animate-pulse'
                  }`} />

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">
                        {order.order_number || order.id.substring(0, 8)}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                      {order.rider_notes && (
                        <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <i className="ri-sticky-note-line"></i> Note
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 font-medium mt-0.5">{getCustomerName(order)}</p>
                    {address && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        <i className="ri-map-pin-line mr-1"></i>{address}
                      </p>
                    )}
                  </div>

                  {/* Right: total + chevron */}
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-gray-900">GH₵ {order.total?.toFixed(2)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <i className={`ri-arrow-${isExpanded ? 'up' : 'down'}-s-line text-gray-400 text-lg shrink-0`}></i>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-gray-100 px-5 pb-5 pt-4 space-y-5">

                    {/* Customer & delivery info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Customer</p>
                        <p className="font-semibold text-gray-900">{getCustomerName(order)}</p>
                        {order.phone && (
                          <a
                            href={`tel:${order.phone}`}
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                          >
                            <i className="ri-phone-line"></i> {order.phone}
                          </a>
                        )}
                        {order.email && (
                          <p className="flex items-center gap-2 text-sm text-gray-500">
                            <i className="ri-mail-line"></i> {order.email}
                          </p>
                        )}
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery Address</p>
                        {address ? (
                          <div>
                            <p className="text-sm text-gray-700 leading-relaxed">{address}</p>
                            <a
                              href={`https://maps.google.com/?q=${encodeURIComponent(address)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1.5"
                            >
                              <i className="ri-map-2-line"></i> Open in Maps
                            </a>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No address provided</p>
                        )}
                      </div>
                    </div>

                    {/* Rider note */}
                    {order.rider_notes && (
                      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <i className="ri-sticky-note-2-line text-amber-500 text-lg shrink-0 mt-0.5"></i>
                        <div>
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">Delivery Note from Admin</p>
                          <p className="text-sm text-amber-800">{order.rider_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Customer delivery note */}
                    {order.delivery_notes && (
                      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                        <i className="ri-chat-3-line text-blue-500 text-lg shrink-0 mt-0.5"></i>
                        <div>
                          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Customer Note</p>
                          <p className="text-sm text-blue-800">{order.delivery_notes}</p>
                        </div>
                      </div>
                    )}

                    {/* Order items */}
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Order Items</p>
                      <div className="space-y-2">
                        {order.order_items?.map(item => (
                          <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                            {item.metadata?.image && (
                              <img
                                src={item.metadata.image}
                                alt={item.product_name}
                                className="w-12 h-12 rounded-lg object-cover shrink-0 border border-gray-200"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                              {item.variant_name && (
                                <p className="text-xs text-gray-500">{item.variant_name}</p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-semibold text-gray-900">GH₵ {item.total_price?.toFixed(2)}</p>
                              <p className="text-xs text-gray-400">×{item.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Order summary */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>Subtotal</span>
                        <span>GH₵ {order.subtotal?.toFixed(2)}</span>
                      </div>
                      {order.shipping_total > 0 && (
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>Delivery fee</span>
                          <span>GH₵ {order.shipping_total?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200 mt-1">
                        <span>Total</span>
                        <span>GH₵ {order.total?.toFixed(2)}</span>
                      </div>
                      {order.payment_method && (
                        <p className="text-xs text-gray-400 text-right pt-1">
                          Payment: {order.payment_method}
                        </p>
                      )}
                    </div>

                    {/* Order meta */}
                    <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                      <span>Ordered: {formatDate(order.created_at)}</span>
                      {order.assigned_at && <span>Assigned: {formatDate(order.assigned_at)}</span>}
                    </div>

                    {/* Action buttons */}
                    {!isDone && (
                      <div className="flex gap-3 pt-1">
                        <button
                          onClick={() => updateStatus(order.id, 'delivered')}
                          disabled={updating === order.id}
                          className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {updating === order.id
                            ? <i className="ri-loader-4-line animate-spin"></i>
                            : <><i className="ri-check-line"></i> Mark Delivered</>
                          }
                        </button>
                        <button
                          onClick={() => updateStatus(order.id, 'completed')}
                          disabled={updating === order.id}
                          className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                        >
                          {updating === order.id
                            ? <i className="ri-loader-4-line animate-spin"></i>
                            : <><i className="ri-checkbox-circle-line"></i> Mark Completed</>
                          }
                        </button>
                      </div>
                    )}

                    {isDone && (
                      <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 rounded-xl text-emerald-700 font-medium text-sm">
                        <i className="ri-check-double-line text-base"></i>
                        Order {order.status}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
