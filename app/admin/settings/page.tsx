'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface StoreSetting {
    key: string;
    value: any;
    description: string;
}

interface DeliveryZone {
    id: string;
    name: string;
    base_fee: number;
    is_accra: boolean;
    is_active: boolean;
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('general');
    const [settings, setSettings] = useState<Record<string, any>>({});
    const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Delivery Zone Edit State
    const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
    const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            // Fetch Settings
            const { data: settingsData, error: settingsError } = await supabase
                .from('store_settings')
                .select('*');

            if (settingsError) throw settingsError;

            // Transform array to object for easier access
            const settingsMap: Record<string, any> = {};
            settingsData?.forEach((s: StoreSetting) => {
                settingsMap[s.key] = s.value;
            });
            setSettings(settingsMap);

            // Fetch Delivery Zones
            const { data: zonesData, error: zonesError } = await supabase
                .from('delivery_zones')
                .select('*')
                .order('base_fee', { ascending: true });

            if (zonesError) throw zonesError;
            setDeliveryZones(zonesData || []);

        } catch (err: any) {
            console.error('Error fetching settings:', err);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveSettings(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);

        try {
            // Prepare updates
            const updates = Object.entries(settings).map(([key, value]) => ({
                key,
                value,
                updated_at: new Date().toISOString()
            }));

            const { error } = await supabase
                .from('store_settings')
                .upsert(updates);

            if (error) throw error;
            toast.success('Settings saved successfully');
        } catch (err: any) {
            console.error('Error saving settings:', err);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    }

    const updateSetting = (key: string, value: any) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // Delivery Zone Handlers
    async function handleSaveZone(e: React.FormEvent) {
        e.preventDefault();
        if (!editingZone) return;

        try {
            const { data, error } = await supabase
                .from('delivery_zones')
                .upsert({
                    id: editingZone.id, // limits creation if id is missing, but for new zones we might need to handle empty id
                    name: editingZone.name,
                    base_fee: editingZone.base_fee,
                    is_accra: editingZone.is_accra,
                    is_active: editingZone.is_active
                })
                .select()
                .single();

            if (error) throw error;

            if (editingZone.id) {
                setDeliveryZones(prev => prev.map(z => z.id === editingZone.id ? data : z));
                toast.success('Zone updated');
            } else {
                setDeliveryZones(prev => [...prev, data]);
                toast.success('Zone created');
            }
            setIsZoneModalOpen(false);
            setEditingZone(null);
        } catch (err: any) {
            console.error('Error saving zone:', err);
            toast.error('Failed to save delivery zone');
        }
    }

    async function handleDeleteZone(id: string) {
        if (!confirm('Are you sure you want to delete this zone?')) return;

        try {
            const { error } = await supabase
                .from('delivery_zones')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setDeliveryZones(prev => prev.filter(z => z.id !== id));
            toast.success('Zone deleted');
        } catch (err: any) {
            console.error('Error deleting zone:', err);
            toast.error('Failed to delete zone');
        }
    }

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                    <p className="text-gray-500">Manage your store configuration and preferences</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar Navigation */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                    <nav className="flex flex-col">
                        {[
                            { id: 'general', label: 'General Info', icon: 'ri-store-2-line' },
                            { id: 'contact', label: 'Contact & Social', icon: 'ri-contacts-line' },
                            { id: 'store', label: 'Store Config', icon: 'ri-settings-4-line' },
                            { id: 'delivery', label: 'Delivery Zones', icon: 'ri-truck-line' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center space-x-3 px-6 py-4 text-left transition-colors ${activeTab === tab.id
                                    ? 'bg-emerald-50 text-emerald-700 font-medium border-l-4 border-emerald-500'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border-l-4 border-transparent'
                                    }`}
                            >
                                <i className={`${tab.icon} text-xl`}></i>
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 lg:p-8">
                        {/* General Info Tab */}
                        {activeTab === 'general' && (
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">General Information</h2>

                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                                        <input
                                            type="text"
                                            value={settings.site_name || ''}
                                            onChange={(e) => updateSetting('site_name', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Tagline</label>
                                        <input
                                            type="text"
                                            value={settings.site_tagline || ''}
                                            onChange={(e) => updateSetting('site_tagline', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
                                        <div className="flex gap-4">
                                            <input
                                                type="text"
                                                value={settings.site_logo || ''}
                                                onChange={(e) => updateSetting('site_logo', e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            />
                                            {settings.site_logo && (
                                                <div className="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center overflow-hidden">
                                                    <img src={settings.site_logo} alt="Logo Preview" className="w-full h-full object-contain" />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Primary Color</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={settings.primary_color || '#000000'}
                                                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                                                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={settings.primary_color || ''}
                                                    onChange={(e) => updateSetting('primary_color', e.target.value)}
                                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all uppercase"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Secondary Color</label>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="color"
                                                    value={settings.secondary_color || '#000000'}
                                                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                                                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                                                />
                                                <input
                                                    type="text"
                                                    value={settings.secondary_color || ''}
                                                    onChange={(e) => updateSetting('secondary_color', e.target.value)}
                                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving && <i className="ri-loader-4-line animate-spin"></i>}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Contact & Social Tab */}
                        {activeTab === 'contact' && (
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">Contact & Social Media</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Physical Address</label>
                                        <textarea
                                            value={settings.contact_address || ''}
                                            onChange={(e) => updateSetting('contact_address', e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                                        <div className="relative">
                                            <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input
                                                type="email"
                                                value={settings.contact_email || ''}
                                                onChange={(e) => updateSetting('contact_email', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                                        <div className="relative">
                                            <i className="ri-phone-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input
                                                type="tel"
                                                value={settings.contact_phone || ''}
                                                onChange={(e) => updateSetting('contact_phone', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp Number (No +)</label>
                                        <div className="relative">
                                            <i className="ri-whatsapp-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input
                                                type="text"
                                                value={settings.whatsapp_number || ''}
                                                onChange={(e) => updateSetting('whatsapp_number', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                                placeholder="233200000000"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Facebook URL</label>
                                        <div className="relative">
                                            <i className="ri-facebook-fill absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input
                                                type="url"
                                                value={settings.social_facebook || ''}
                                                onChange={(e) => updateSetting('social_facebook', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Instagram URL</label>
                                        <div className="relative">
                                            <i className="ri-instagram-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input
                                                type="url"
                                                value={settings.social_instagram || ''}
                                                onChange={(e) => updateSetting('social_instagram', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Twitter/X URL</label>
                                        <div className="relative">
                                            <i className="ri-twitter-x-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input
                                                type="url"
                                                value={settings.social_twitter || ''}
                                                onChange={(e) => updateSetting('social_twitter', e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-6 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving && <i className="ri-loader-4-line animate-spin"></i>}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Store Config Tab */}
                        {activeTab === 'store' && (
                            <form onSubmit={handleSaveSettings} className="space-y-6">
                                <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-100 pb-4 mb-6">Store Configuration</h2>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="font-medium text-gray-900">Stop All Deliveries</label>
                                            <button
                                                type="button"
                                                onClick={() => updateSetting('delivery_unavailable', !settings.delivery_unavailable)}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settings.delivery_unavailable ? 'bg-red-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${settings.delivery_unavailable ? 'translate-x-6' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">Prevent customers from placing orders with delivery (e.g. during holidays).</p>
                                    </div>

                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="font-medium text-gray-900">Same Day Delivery</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updateSetting('same_day_delivery_enabled', !settings.same_day_delivery_enabled);
                                                    if (!settings.same_day_delivery_enabled) updateSetting('next_day_delivery_enabled', false);
                                                }}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settings.same_day_delivery_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${settings.same_day_delivery_enabled ? 'translate-x-6' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">Show a notice that orders placed today will be delivered today.</p>
                                    </div>

                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="font-medium text-gray-900">Next Day Delivery</label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    updateSetting('next_day_delivery_enabled', !settings.next_day_delivery_enabled);
                                                    if (!settings.next_day_delivery_enabled) updateSetting('same_day_delivery_enabled', false);
                                                }}
                                                className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${settings.next_day_delivery_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 ${settings.next_day_delivery_enabled ? 'translate-x-6' : 'translate-x-0'}`}></span>
                                            </button>
                                        </div>
                                        <p className="text-sm text-gray-500">Show a notice that orders placed today will be delivered tomorrow.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Currency Symbol</label>
                                        <input
                                            type="text"
                                            value={settings.currency_symbol || ''}
                                            onChange={(e) => updateSetting('currency_symbol', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Currency Code</label>
                                        <input
                                            type="text"
                                            value={settings.currency || ''}
                                            onChange={(e) => updateSetting('currency', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Loyalty Points Per Item</label>
                                        <input
                                            type="number"
                                            value={settings.loyalty_points_per_item || 0}
                                            onChange={(e) => updateSetting('loyalty_points_per_item', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Min Points to Redeem</label>
                                        <input
                                            type="number"
                                            value={settings.loyalty_min_redeem || 0}
                                            onChange={(e) => updateSetting('loyalty_min_redeem', parseInt(e.target.value))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>

                                </div>

                                <div className="pt-6 border-t border-gray-100 flex justify-end">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving && <i className="ri-loader-4-line animate-spin"></i>}
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* Delivery Zones Tab */}
                        {activeTab === 'delivery' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                                    <h2 className="text-lg font-semibold text-gray-900">Delivery Zones</h2>
                                    <button
                                        onClick={() => {
                                            setEditingZone({ id: '', name: '', base_fee: 0, is_accra: false, is_active: true });
                                            setIsZoneModalOpen(true);
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                    >
                                        <i className="ri-add-line"></i> Add Zone
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                                                <th className="py-3 px-4">Zone Name</th>
                                                <th className="py-3 px-4">Fee (GH₵)</th>
                                                <th className="py-3 px-4">Type</th>
                                                <th className="py-3 px-4">Status</th>
                                                <th className="py-3 px-4 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {deliveryZones.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-gray-500">No delivery zones configured</td>
                                                </tr>
                                            ) : (
                                                deliveryZones.map(zone => (
                                                    <tr key={zone.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="py-3 px-4 font-medium text-gray-900">{zone.name}</td>
                                                        <td className="py-3 px-4">{zone.base_fee.toFixed(2)}</td>
                                                        <td className="py-3 px-4">
                                                            {zone.is_accra ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Accra</span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Regional</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4">
                                                            {zone.is_active ? (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">Active</span>
                                                            ) : (
                                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">Inactive</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-4 text-right space-x-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingZone(zone);
                                                                    setIsZoneModalOpen(true);
                                                                }}
                                                                className="text-gray-400 hover:text-emerald-600 transition-colors"
                                                            >
                                                                <i className="ri-pencil-line text-lg"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteZone(zone.id)}
                                                                className="text-gray-400 hover:text-red-500 transition-colors"
                                                            >
                                                                <i className="ri-delete-bin-line text-lg"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Edit Zone Modal */}
                                {isZoneModalOpen && editingZone && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                                        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                                            <h3 className="text-lg font-bold text-gray-900 mb-4">{editingZone.id ? 'Edit Zone' : 'New Delivery Zone'}</h3>

                                            <form onSubmit={handleSaveZone} className="space-y-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        value={editingZone.name}
                                                        onChange={(e) => setEditingZone({ ...editingZone, name: e.target.value })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                        placeholder="e.g. Greater Accra, Ashanti Region"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Base Delivery Fee</label>
                                                    <input
                                                        type="number"
                                                        required
                                                        min="0"
                                                        step="0.01"
                                                        value={editingZone.base_fee}
                                                        onChange={(e) => setEditingZone({ ...editingZone, base_fee: parseFloat(e.target.value) })}
                                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                    />
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingZone.is_accra}
                                                            onChange={(e) => setEditingZone({ ...editingZone, is_accra: e.target.checked })}
                                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                                                        />
                                                        <span className="text-sm text-gray-700">Is Accra Zone?</span>
                                                    </label>

                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={editingZone.is_active}
                                                            onChange={(e) => setEditingZone({ ...editingZone, is_active: e.target.checked })}
                                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-gray-300"
                                                        />
                                                        <span className="text-sm text-gray-700">Active Status</span>
                                                    </label>
                                                </div>

                                                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsZoneModalOpen(false)}
                                                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="submit"
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                                                    >
                                                        Save Zone
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
