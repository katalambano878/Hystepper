'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({
        next_day_delivery_enabled: false,
        delivery_unavailable: false,
        loyalty_rate: 10 // implied default
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            // Fetch all store settings
            const { data, error } = await supabase.from('store_settings').select('key, value');
            if (error) throw error;

            const newSettings: any = { ...settings };
            data?.forEach((item: any) => {
                if (item.key === 'next_day_delivery_enabled') newSettings.next_day_delivery_enabled = item.value === true;
                if (item.key === 'delivery_unavailable') newSettings.delivery_unavailable = item.value === true;
            });

            setSettings(newSettings);
        } catch (err) {
            console.error('Error fetching settings:', err);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    }

    async function toggleSetting(key: string, currentValue: boolean) {
        try {
            const newValue = !currentValue;
            const { error } = await supabase
                .from('store_settings')
                .upsert({ key, value: newValue, updated_at: new Date().toISOString() });

            if (error) throw error;

            setSettings(prev => ({ ...prev, [key]: newValue }));
            toast.success('Setting updated');
        } catch (err) {
            console.error('Error updating setting:', err);
            toast.error('Failed to update setting');
        }
    }

    if (loading) return <div className="p-8">Loading settings...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Store Settings</h1>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">Delivery Management</h2>
                    <p className="text-sm text-gray-500 mt-1">Control delivery availability and options.</p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">Next Day Delivery</p>
                            <p className="text-sm text-gray-500">Enable or disable the express/next-day delivery option at checkout.</p>
                        </div>
                        <button
                            onClick={() => toggleSetting('next_day_delivery_enabled', settings.next_day_delivery_enabled)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${settings.next_day_delivery_enabled ? 'bg-emerald-600' : 'bg-gray-200'}`}
                        >
                            <span
                                className={`${settings.next_day_delivery_enabled ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>

                    <div className="border-t border-gray-100 pt-6 flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-900">Disable Delivery (Pickup Only)</p>
                            <p className="text-sm text-gray-500">If enabled, delivery options will be hidden and only Store Pickup will be available.</p>
                        </div>
                        <button
                            onClick={() => toggleSetting('delivery_unavailable', settings.delivery_unavailable)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 ${settings.delivery_unavailable ? 'bg-red-600' : 'bg-gray-200'}`}
                        >
                            <span
                                className={`${settings.delivery_unavailable ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">System Info</h2>
                </div>
                <div className="p-6">
                    <p className="text-sm text-gray-500">App Version: 1.0.0 (Hy_stepper)</p>
                </div>
            </div>
        </div>
    );
}
