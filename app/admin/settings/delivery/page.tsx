'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import Link from 'next/link';

interface DeliveryZone {
    id: string;
    name: string;
    base_fee: number;
    is_accra: boolean;
    is_active: boolean;
}

export default function DeliverySettingsPage() {
    const [loading, setLoading] = useState(true);
    const [zones, setZones] = useState<DeliveryZone[]>([]);

    // Edit/Create State
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        base_fee: 0,
        is_accra: false,
        is_active: true
    });

    useEffect(() => {
        fetchZones();
    }, []);

    async function fetchZones() {
        try {
            const { data, error } = await supabase
                .from('delivery_zones')
                .select('*')
                .order('name');

            if (error) throw error;
            setZones(data || []);
        } catch (err) {
            console.error('Error fetching zones:', err);
            toast.error('Failed to load delivery zones');
        } finally {
            setLoading(false);
        }
    }

    function handleEdit(zone: DeliveryZone) {
        setFormData({
            name: zone.name,
            base_fee: zone.base_fee,
            is_accra: zone.is_accra,
            is_active: zone.is_active
        });
        setEditingId(zone.id);
        setIsEditing(true);
    }

    function handleAddNew() {
        setFormData({
            name: '',
            base_fee: 0, // Default fee
            is_accra: false,
            is_active: true
        });
        setEditingId(null);
        setIsEditing(true);
    }

    async function handleSave() {
        if (!formData.name) return toast.error('Region Name is required');

        try {
            const payload = {
                name: formData.name,
                base_fee: formData.base_fee,
                is_accra: formData.is_accra,
                is_active: formData.is_active,
                updated_at: new Date().toISOString()
            };

            if (editingId) {
                // Update
                const { error } = await supabase
                    .from('delivery_zones')
                    .update(payload)
                    .eq('id', editingId);
                if (error) throw error;
                toast.success('Zone updated');
            } else {
                // Insert
                const { error } = await supabase
                    .from('delivery_zones')
                    .insert(payload);
                if (error) throw error;
                toast.success('Zone added');
            }

            setIsEditing(false);
            fetchZones();

        } catch (err) {
            console.error('Error saving zone:', err);
            toast.error('Failed to save zone');
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this zone?')) return;

        try {
            const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
            if (error) throw error;
            toast.success('Zone deleted');
            fetchZones();
        } catch (err) {
            toast.error('Failed to delete zone');
        }
    }

    if (loading) return <div className="p-8">Loading delivery settings...</div>;

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                    <Link href="/admin/settings" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <i className="ri-arrow-left-line text-xl"></i>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Delivery Zones</h1>
                        <p className="text-gray-600">Manage shipping regions and fees</p>
                    </div>
                </div>
                <button
                    onClick={handleAddNew}
                    className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold transition-colors flex items-center"
                >
                    <i className="ri-add-line mr-2"></i>
                    Add New Zone
                </button>
            </div>

            {isEditing && (
                <div className="bg-white rounded-xl shadow p-6 border border-emerald-100 mb-6">
                    <h2 className="font-bold text-lg mb-4">{editingId ? 'Edit Zone' : 'New Delivery Zone'}</h2>
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Region Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-emerald-500"
                                placeholder="e.g. Greater Accra"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">Delivery Fee (GH₵)</label>
                            <input
                                type="number"
                                value={formData.base_fee}
                                onChange={e => setFormData({ ...formData, base_fee: parseFloat(e.target.value) })}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-emerald-500"
                            />
                        </div>
                        <div className="flex items-center space-x-4 pt-4">
                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_accra}
                                    onChange={e => setFormData({ ...formData, is_accra: e.target.checked })}
                                    className="w-5 h-5 text-emerald-600 rounded"
                                />
                                <span className="font-medium">Is Inside Accra?</span>
                            </label>

                            <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-5 h-5 text-emerald-600 rounded"
                                />
                                <span className="font-medium">Active</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-6 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800"
                        >
                            Save Zone
                        </button>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700">Region Name</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700">Fee</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700">Type</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700">Status</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {zones.map((zone) => (
                            <tr key={zone.id} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-4 px-6 font-medium text-gray-900">{zone.name}</td>
                                <td className="py-4 px-6 text-gray-700">GH₵ {zone.base_fee.toFixed(2)}</td>
                                <td className="py-4 px-6">
                                    {zone.is_accra ? (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full font-bold">Inside Accra</span>
                                    ) : (
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Region</span>
                                    )}
                                </td>
                                <td className="py-4 px-6">
                                    {zone.is_active ? (
                                        <span className="text-emerald-600 text-sm font-semibold flex items-center">
                                            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span>
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-gray-400 text-sm font-medium">Inactive</span>
                                    )}
                                </td>
                                <td className="py-4 px-6">
                                    <div className="flex space-x-2">
                                        <button
                                            onClick={() => handleEdit(zone)}
                                            className="p-2 hover:bg-blue-50 text-blue-600 rounded transition"
                                        >
                                            <i className="ri-pencil-line"></i>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(zone.id)}
                                            className="p-2 hover:bg-red-50 text-red-600 rounded transition"
                                        >
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {zones.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                        No delivery zones found. Add one to get started.
                    </div>
                )}
            </div>
        </div>
    );
}
