'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';

interface Order {
  id: string;
  orderNumber: string;
  date: string;
  status: string;
  total: number;
  items: {
    id: string;
    name: string;
    image: string;
    quantity: number;
    price: number;
  }[];
}

export default function OrderHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    async function fetchOrders() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase
          .from('orders')
          .select(`
                    *,
                    order_items (*)
                `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data) {
          const formattedOrders = data.map(order => ({
            id: order.id,
            orderNumber: order.order_number,
            date: order.created_at,
            status: order.status,
            total: order.total,
            items: order.order_items.map((item: any) => ({
              id: item.id,
              name: item.product_name,
              image: item.metadata?.image || 'https://via.placeholder.com/150',
              quantity: item.quantity,
              price: item.unit_price
            }))
          }));
          setOrders(formattedOrders);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-700';
      case 'shipped':
        return 'bg-blue-100 text-blue-700';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default: // pending
        return 'bg-gray-100 text-gray-700';
    }
  };

  const handleReorder = (order: Order) => {
    let added = 0;
    order.items.forEach(item => {
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
      });
      added++;
    });
    toast.success(`${added} item${added > 1 ? 's' : ''} added to cart`);
  };

  const handleDownloadInvoice = async (order: Order) => {
    // Generate a printable invoice in a new window
    const invoiceWindow = window.open('', '_blank');
    if (!invoiceWindow) {
      toast.error('Please allow popups to download invoices');
      return;
    }

    const itemsHtml = order.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">GH₵ ${item.price.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">GH₵ ${(item.price * item.quantity).toFixed(2)}</td>
      </tr>
    `).join('');

    invoiceWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
          .logo { font-size: 24px; font-weight: bold; color: #047857; }
          .invoice-title { font-size: 28px; font-weight: bold; color: #333; text-align: right; }
          .invoice-meta { text-align: right; font-size: 14px; color: #666; margin-top: 8px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { background: #f3f4f6; padding: 10px 8px; text-align: left; font-weight: 600; }
          .totals { text-align: right; margin-top: 20px; }
          .totals td { padding: 4px 0; }
          .total-row { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 8px; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999; text-align: center; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">Hy_stepper</div>
            <p style="font-size: 14px; color: #666; margin-top: 4px;">Premium Footwear</p>
          </div>
          <div>
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-meta">
              <p><strong>Order:</strong> ${order.orderNumber}</p>
              <p><strong>Date:</strong> ${new Date(order.date).toLocaleDateString()}</p>
              <p><strong>Status:</strong> ${order.status}</p>
            </div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table class="totals" style="width: 300px; margin-left: auto;">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right;">GH₵ ${order.items.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td>Total:</td>
            <td style="text-align: right;">GH₵ ${order.total.toFixed(2)}</td>
          </tr>
        </table>

        <div class="footer">
          <p>Thank you for shopping with Hy_stepper!</p>
          <p>For questions, contact us on WhatsApp or Instagram</p>
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `);
    invoiceWindow.document.close();
  };

  if (loading) {
    return (
      <div className="py-8 text-center">
        <i className="ri-loader-4-line animate-spin text-3xl text-gold-600"></i>
        <p className="mt-2 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="py-12 text-center bg-white rounded-lg border border-gray-200">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="ri-shopping-bag-line text-3xl text-gray-400"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">No orders yet</h3>
        <p className="text-gray-500 mb-6">Start shopping to see your orders here.</p>
        <Link href="/shop" className="inline-block bg-gold-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-gold-700 transition-colors">
          Go to Shop
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Order History</h2>
        <div className="text-sm text-gray-600">
          Total Orders: <span className="font-bold text-gray-900">{orders.length}</span>
        </div>
      </div>

      <div className="space-y-6">
        {orders.map((order) => (
          <div key={order.id} className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Order Number</p>
                    <p className="font-bold text-gray-900">{order.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(order.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-1">Total</p>
                    <p className="font-bold text-gold-700">GH₵{order.total.toFixed(2)}</p>
                  </div>
                </div>
                <div>
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap capitalize ${getStatusColor(order.status)}`}>
                    {order.status.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 mb-4">
                {order.items.map((item) => (
                  <div key={item.id} className="flex space-x-4">
                    <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover object-center"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 mb-1">{item.name}</h4>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-sm font-bold text-gray-900 mt-1">GH₵{item.price.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <Link
                  href={`/order-tracking?order=${order.orderNumber}`}
                  className="px-4 py-2 bg-gold-600 text-white rounded-lg font-semibold hover:bg-gold-700 transition-colors whitespace-nowrap"
                >
                  <i className="ri-map-pin-line mr-2"></i>
                  Track Order
                </Link> */}
              <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleReorder(order)}
                  className="px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-refresh-line mr-2"></i>
                  Reorder
                </button>
                <button
                  onClick={() => handleDownloadInvoice(order)}
                  className="px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-download-line mr-2"></i>
                  Invoice
                </button>
                <Link
                  href="/contact"
                  className="px-4 py-2 border-2 border-gray-300 text-gray-900 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  <i className="ri-customer-service-line mr-2"></i>
                  Get Help
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
