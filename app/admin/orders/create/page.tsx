'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CartItem {
    id: string;
    product_id: string;
    name: string;
    price: number;
    quantity: number;
    variant_id?: string;
    variant_name?: string;
    image?: string;
}

interface DeliveryZone {
    id: string;
    name: string;
    is_accra: boolean;
    base_fee: number;
    per_item_fee: number;
    transport_service: string | null;
}

export default function CreateOrderPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [zones, setZones] = useState<DeliveryZone[]>([]);

    // Variant selection state for the product being added
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedVariant, setSelectedVariant] = useState<string>('');

    const [customer, setCustomer] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: 'Accra',
        region: ''
    });

    const [paymentStatus, setPaymentStatus] = useState('pending');
    const [paymentOption, setPaymentOption] = useState('full_payment');

    // Fetch delivery zones on mount
    useEffect(() => {
        async function fetchZones() {
            const { data } = await supabase
                .from('delivery_zones')
                .select('*')
                .eq('is_active', true)
                .order('name');
            if (data) setZones(data);
        }
        fetchZones();
    }, []);

    // Product Search - includes variants
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                const { data } = await supabase
                    .from('products')
                    .select('id, name, price, sku, product_code, product_images(url), product_variants(id, name, option1, option2, price, quantity)')
                    .or(`name.ilike.%${searchTerm}%,product_code.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`)
                    .eq('status', 'active')
                    .limit(10);

                setProducts(data || []);
            } else {
                setProducts([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const selectProduct = (product: any) => {
        setSelectedProduct(product);
        setSelectedVariant('');
    };

    const addToCart = () => {
        if (!selectedProduct) return;

        const variant = selectedProduct.product_variants?.find((v: any) => v.id === selectedVariant);
        const cartItem: CartItem = {
            id: variant ? `${selectedProduct.id}-${variant.id}` : selectedProduct.id,
            product_id: selectedProduct.id,
            name: selectedProduct.name,
            price: variant?.price || selectedProduct.price,
            quantity: 1,
            variant_id: variant?.id,
            variant_name: variant ? [variant.name || variant.option1, variant.option2].filter(Boolean).join(' / ') : undefined,
            image: selectedProduct.product_images?.[0]?.url
        };

        const existing = cart.find(item => item.id === cartItem.id);
        if (existing) {
            setCart(cart.map(item => item.id === cartItem.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, cartItem]);
        }

        setSelectedProduct(null);
        setSelectedVariant('');
        setSearchTerm('');
        setProducts([]);
    };

    const addDirectly = (product: any) => {
        // If product has variants, show variant picker
        if (product.product_variants && product.product_variants.length > 0) {
            selectProduct(product);
            return;
        }
        // No variants - add directly
        const cartItem: CartItem = {
            id: product.id,
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.product_images?.[0]?.url
        };
        const existing = cart.find(item => item.id === cartItem.id);
        if (existing) {
            setCart(cart.map(item => item.id === cartItem.id ? { ...item, quantity: item.quantity + 1 } : item));
        } else {
            setCart([...cart, cartItem]);
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

    // Dynamic fee calculation
    const activeZone = zones.find(z => z.name === customer.region);
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const shippingFee = activeZone
        ? activeZone.is_accra
            ? activeZone.base_fee
            : activeZone.base_fee + (activeZone.per_item_fee * totalItems)
        : 0;

    const total = subtotal + shippingFee;

    const handleSubmit = async () => {
        if (cart.length === 0) {
            toast.error('Add items to cart');
            return;
        }
        if (!customer.email || !customer.firstName) {
            toast.error('Customer details required');
            return;
        }
        if (!customer.region) {
            toast.error('Select a delivery region');
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
                    shipping_total: shippingFee,
                    total,
                    shipping_method: 'standard',
                    payment_method: 'manual',
                    payment_option: paymentOption,
                    shipping_address: customer,
                    billing_address: customer,
                    metadata: {
                        source: 'admin_manual',
                        first_name: customer.firstName,
                        last_name: customer.lastName,
                        delivery_zone: activeZone?.name,
                        transport_service: activeZone?.transport_service
                    }
                }])
                .select()
                .single();

            if (orderError) throw orderError;

            const orderItems = cart.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                product_name: item.name,
                variant_name: item.variant_name || null,
                quantity: item.quantity,
                unit_price: item.price,
                total_price: item.price * item.quantity
            }));

            const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
            if (itemsError) throw itemsError;

            toast.success('Order created successfully');
            router.push(`/admin/orders/${order.id}`);

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
                            placeholder="Search by name, product code, or SKU..."
                            className="w-full px-4 py-2 border rounded-lg"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                        {products.length > 0 && !selectedProduct && (
                            <div className="mt-2 border rounded-lg bg-white divide-y max-h-60 overflow-y-auto">
                                {products.map(p => (
                                    <div key={p.id} className="p-3 hover:bg-gray-50 flex justify-between items-center cursor-pointer" onClick={() => addDirectly(p)}>
                                        <div>
                                            <p className="font-medium">{p.name}</p>
                                            <p className="text-sm text-gray-500">
                                                GH₵ {p.price}
                                                {p.product_code && <span className="ml-2 text-gray-400">({p.product_code})</span>}
                                                {p.product_variants?.length > 0 && <span className="ml-2 text-blue-500 text-xs">{p.product_variants.length} variants</span>}
                                            </p>
                                        </div>
                                        <i className="ri-add-circle-line text-2xl text-emerald-600"></i>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Variant Picker */}
                        {selectedProduct && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <h3 className="font-semibold text-gray-900 mb-2">
                                    Select variant for: <span className="text-blue-700">{selectedProduct.name}</span>
                                </h3>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {selectedProduct.product_variants?.map((v: any) => (
                                        <button
                                            key={v.id}
                                            onClick={() => setSelectedVariant(v.id)}
                                            className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer ${
                                                selectedVariant === v.id
                                                    ? 'border-blue-600 bg-blue-100 text-blue-800'
                                                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                                            }`}
                                        >
                                            {[v.name || v.option1, v.option2].filter(Boolean).join(' / ')}
                                            <span className="text-gray-400 ml-1">(GH₵ {v.price})</span>
                                        </button>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={addToCart}
                                        disabled={!selectedVariant}
                                        className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                                    >
                                        Add to Order
                                    </button>
                                    <button
                                        onClick={() => { setSelectedProduct(null); setSelectedVariant(''); }}
                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4">Order Items ({cart.length})</h2>
                        {cart.length === 0 ? (
                            <p className="text-gray-500 text-center py-4">No items added</p>
                        ) : (
                            <div className="divide-y">
                                {cart.map(item => (
                                    <div key={item.id} className="py-3 flex justify-between items-center">
                                        <div>
                                            <p className="font-medium">{item.name}</p>
                                            {item.variant_name && (
                                                <p className="text-sm text-blue-600">{item.variant_name}</p>
                                            )}
                                            <p className="text-sm text-gray-500">GH₵ {item.price.toFixed(2)}</p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer">-</button>
                                            <span className="font-medium">{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center cursor-pointer">+</button>
                                            <button onClick={() => removeFromCart(item.id)} className="text-red-500 ml-2 cursor-pointer"><i className="ri-delete-bin-line"></i></button>
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
                                placeholder="First Name *"
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
                                placeholder="Email *"
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
                            <div>
                                <label className="text-sm font-medium text-gray-700">Delivery Region *</label>
                                <select
                                    className="w-full p-2 border rounded mt-1"
                                    value={customer.region}
                                    onChange={e => setCustomer({ ...customer, region: e.target.value })}
                                >
                                    <option value="">Select Delivery Zone</option>
                                    {zones.map(z => (
                                        <option key={z.id} value={z.name}>{z.name} (GH₵ {z.base_fee})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Order Settings */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h2 className="text-lg font-semibold mb-4">Payment & Delivery</h2>
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
                                <label className="text-sm font-medium">Payment Option</label>
                                <select
                                    className="w-full p-2 border rounded mt-1"
                                    value={paymentOption}
                                    onChange={e => setPaymentOption(e.target.value)}
                                >
                                    <option value="full_payment">Full Payment (Item + Delivery)</option>
                                    <option value="item_only">Item Only (Pay delivery on arrival)</option>
                                    <option value="pay_on_delivery">Pay on Delivery (Full amount)</option>
                                </select>
                            </div>
                        </div>

                        {/* Fee Breakdown */}
                        <div className="border-t mt-4 pt-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Subtotal</span>
                                <span>GH₵ {subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span>
                                    Delivery Fee
                                    {activeZone && !activeZone.is_accra && activeZone.per_item_fee > 0 && (
                                        <span className="text-gray-400 text-xs block">
                                            {activeZone.base_fee} + ({activeZone.per_item_fee} × {totalItems} items)
                                        </span>
                                    )}
                                </span>
                                <span>GH₵ {shippingFee.toFixed(2)}</span>
                            </div>
                            {activeZone?.transport_service && (
                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                    <i className="ri-bus-line"></i>
                                    Via {activeZone.transport_service}
                                </div>
                            )}
                            <div className="flex justify-between font-bold text-lg pt-2 border-t">
                                <span>Total</span>
                                <span>GH₵ {total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            disabled={loading}
                            className="w-full mt-6 bg-emerald-700 text-white py-3 rounded-lg font-semibold hover:bg-emerald-800 disabled:opacity-50 cursor-pointer"
                        >
                            {loading ? 'Creating...' : 'Create Order'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
