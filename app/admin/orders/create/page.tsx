'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function CreateOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);

    const [customer, setCustomer] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: 'Accra',
        region: 'Greater Accra'
    });

    const [deliveryMethod, setDeliveryMethod] = useState('standard');
    const [paymentStatus, setPaymentStatus] = useState('pending');

    // Product Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                const { data } = await supabase
                    .from('products')
                    .select('id, name, price, images:product_images(url)')
                    .ilike('name', `%${searchTerm}%`)
                    .limit(5);

                setProducts(data || []);
            } else {
                setProducts([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const addToCart = (product: any) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const removeFromCart = (id: string) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateQuantity = (id: string, delta: number) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = deliveryMethod === 'express' ? 25 : deliveryMethod === 'standard' ? 15 : 0;
    const total = subtotal + shipping;

    const handleSubmit = async () => {
        if (cart.length === 0) {
            toast.error('Add items to cart');
            return;
        }
        if (!customer.email || !customer.firstName) {
            toast.error('Customer details required');
            return;
        }

        setLoading(true);
        try {
            const orderNumber = `MAN-${Date.now()}`;

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([{
                    order_number: orderNumber,
                    email: customer.email,
                    phone: customer.phone,
                    status: 'pending',
                    payment_status: paymentStatus,
                    currency: 'GHS',
                    subtotal,
                    shipping_total: shipping,
                    total,
                    shipping_method: deliveryMethod,
                    payment_method: 'manual',
                    shipping_address: customer,
                    billing_address: customer,
                    metadata: {
                        source: 'admin_manual',
                        first_name: customer.firstName,
                        last_name: customer.lastName
                    }
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            const orderItems = cart.map(item => ({
                order_id: order.id,
                product_id: item.id,
                product_name: item.name,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
            if (itemsError) throw itemsError;

            toast.success('Order created successfully');
            router.push(`/admin/orders/${order.id}`); // Or just /admin/orders

        } catch (err: any) {
            console.error('Create order error:', err);
            toast.error('Failed to create order: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Create Manual Order</h1>

            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    {/* Product Search */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4">Add Products</h2>
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="w-full px-4 py-2 border rounded-lg"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {products.length > 0 && (
                            <div className="mt-2 border rounded-lg bg-white divide-y max-h-60 overflow-y-auto">
                                {products.map(p => (
                                    <div key={p.id} className="p-3 hover:bg-gray-50 flex justify-between items-center cursor-pointer" onClick={() => addToCart(p)}>
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-sm text-gray-500">GH₵ {p.price}</p>
                                        </div>
                                        <i className="ri-add-circle-line text-2xl text-emerald-600"></i>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4">Order Items</h2>
                        {cart.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No items added</p>
                        ) : (
                            <div className="divide-y">
                                {cart.map(item => (
                                    <div key={item.id} className="py-3 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-sm text-gray-500">GH₵ {item.price}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-gray-100 rounded-full">-</button>
                                            <span>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-gray-100 rounded-full">+</button>
                                            <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-2"><i className="ri-delete-bin-line"></i></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    {/* Customer Details */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4">Customer Details</h2>
                        <div className="space-y-3">
                            <input
                                className="w-full p-2 border rounded"
                                placeholder="First Name"
                                value={customer.firstName}
                                onChange={e => setCustomer({ ...customer, firstName: e.target.value })}
                            />
                            <input
                                className="w-full p-2 border rounded"
                                placeholder="Last Name"
                                value={customer.lastName}
                                onChange={e => setCustomer({ ...customer, lastName: e.target.value })}
                            />
                            <input
                                className="w-full p-2 border rounded"
                                placeholder="Email"
                                value={customer.email}
                                onChange={e => setCustomer({ ...customer, email: e.target.value })}
                            />
                            <input
                                className="w-full p-2 border rounded"
                                placeholder="Phone"
                                value={customer.phone}
                                onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                            />
                            <input
                                className="w-full p-2 border rounded"
                                placeholder="Address"
                                value={customer.address}
                                onChange={e => setCustomer({ ...customer, address: e.target.value })}
                            />
                            <select
                                className="w-full p-2 border rounded"
                                value={customer.region}
                                onChange={e => setCustomer({ ...customer, region: e.target.value })}
                            >
                                <option>Greater Accra</option>
                                <option>Ashanti</option>
                                {/* Add others as needed */}
                            </select>
                        </div>
                    </div>

                    {/* Order Settings */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4">Payment & Shipping</h2>
                        <div className="space-y-3">
                            <div>
                                <label className="text-sm font-medium">Payment Status</label>
                                <select
                                    className="w-full p-2 border rounded mt-1"
                                    value={paymentStatus}
                                    onChange={e => setPaymentStatus(e.target.value)}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm font-medium">Shipping Method</label>
                                <select
                                    className="w-full p-2 border rounded mt-1"
                                    value={deliveryMethod}
                                    onChange={e => setDeliveryMethod(e.target.value)}
                                >
                                    <option value="standard">Standard (GH₵ 15)</option>
                                    <option value="express">Express (GH₵ 25)</option>
                                    <option value="pickup">Pickup (Free)</option>
                                </select>
                            </div>
                        </div>

                        <div className="border-t mt-4 pt-4 space-y-2">
                            <div className="flex justify-between">
                                <span>Subtotal</span>
                                <span>GH₵ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Shipping</span>
                                <span>GH₵ {shipping.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg">
                                <span>Total</span>
                                <span>GH₵ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full mt-6 bg-emerald-700 text-white py-3 rounded-lg font-semibold hover:bg-emerald-800 disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Order'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
