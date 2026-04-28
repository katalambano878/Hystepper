'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Polls Supabase for things the admin should know about: newly paid orders,
// orders the rider couldn't deliver (returned), and products running low on
// stock. "Unread" state is per-browser via localStorage so each staff member
// gets their own badge — there's no notifications table to write to.

type FeedItem = {
    id: string;            // unique key for de-dupe + storage
    kind: 'order' | 'return' | 'stock';
    title: string;
    message: string;
    href: string;
    createdAt: string;
    icon: string;
    accent: string;        // tailwind classes for the icon chip
};

const STORAGE_KEY = 'admin_notifications_seen_v1';
const MAX_FEED = 25;
const POLL_MS = 60_000;

function loadSeen(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

function saveSeen(set: Set<string>) {
    if (typeof window === 'undefined') return;
    try {
        // Cap to avoid unbounded growth.
        const arr = Array.from(set).slice(-500);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    } catch {
        /* quota / disabled storage — silently ignore */
    }
}

function timeAgo(iso: string): string {
    const d = new Date(iso).getTime();
    if (!Number.isFinite(d)) return '';
    const diff = Date.now() - d;
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const day = Math.floor(h / 24);
    if (day < 7) return `${day}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default function NotificationsBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<FeedItem[]>([]);
    const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load notifications from Supabase. Runs on mount + every minute.
    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                setLoading(true);

                const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

                const [ordersRes, returnsRes, lowStockRes] = await Promise.all([
                    supabase
                        .from('orders')
                        .select('id, order_number, total, status, payment_status, created_at, shipping_address, metadata')
                        .eq('payment_status', 'paid')
                        .gte('created_at', sinceIso)
                        .order('created_at', { ascending: false })
                        .limit(15),
                    supabase
                        .from('orders')
                        .select('id, order_number, status, created_at, shipping_address, metadata')
                        .eq('status', 'returned')
                        .gte('created_at', sinceIso)
                        .order('created_at', { ascending: false })
                        .limit(10),
                    supabase
                        .from('products')
                        .select('id, name, quantity, status, updated_at')
                        .eq('status', 'active')
                        .lte('quantity', 5)
                        .order('updated_at', { ascending: false })
                        .limit(10),
                ]);

                if (cancelled) return;

                const feed: FeedItem[] = [];

                for (const o of ordersRes.data ?? []) {
                    const ship: any = (o as any).shipping_address || {};
                    const customer = ship.full_name
                        || `${ship.first_name ?? ''} ${ship.last_name ?? ''}`.trim()
                        || 'Customer';
                    const isPos = !!(o as any).metadata?.pos_sale;
                    feed.push({
                        id: `order:${o.id}`,
                        kind: 'order',
                        title: `${isPos ? 'POS sale' : 'New paid order'} · #${(o as any).order_number ?? o.id.slice(0, 8)}`,
                        message: `${customer} · GH₵${Number((o as any).total || 0).toFixed(2)}`,
                        href: `/admin/orders/${o.id}`,
                        createdAt: (o as any).created_at,
                        icon: isPos ? 'ri-store-3-line' : 'ri-shopping-bag-line',
                        accent: 'bg-emerald-100 text-emerald-700',
                    });
                }

                for (const o of returnsRes.data ?? []) {
                    const note = (o as any).metadata?.return_note as string | undefined;
                    feed.push({
                        id: `return:${o.id}`,
                        kind: 'return',
                        title: `Return · #${(o as any).order_number ?? o.id.slice(0, 8)}`,
                        message: note ? `Rider: ${note}` : 'Rider could not deliver this order.',
                        href: `/admin/orders/${o.id}`,
                        createdAt: (o as any).created_at,
                        icon: 'ri-arrow-go-back-line',
                        accent: 'bg-orange-100 text-orange-700',
                    });
                }

                for (const p of lowStockRes.data ?? []) {
                    const qty = Number((p as any).quantity) || 0;
                    feed.push({
                        id: `stock:${p.id}:${qty}`,
                        kind: 'stock',
                        title: qty <= 0 ? 'Out of stock' : 'Low stock',
                        message: `${(p as any).name} · ${qty} left`,
                        href: `/admin/inventory`,
                        createdAt: (p as any).updated_at,
                        icon: qty <= 0 ? 'ri-error-warning-line' : 'ri-alert-line',
                        accent: qty <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                    });
                }

                feed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                setItems(feed.slice(0, MAX_FEED));
            } catch (err) {
                console.error('[NotificationsBell] load failed', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        const interval = setInterval(load, POLL_MS);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    // Close popover when clicking outside.
    useEffect(() => {
        if (!open) return;
        function onDocClick(e: MouseEvent) {
            if (!containerRef.current) return;
            if (!containerRef.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [open]);

    const unreadCount = useMemo(
        () => items.filter((it) => !seen.has(it.id)).length,
        [items, seen]
    );

    const markAllRead = () => {
        const next = new Set(seen);
        for (const it of items) next.add(it.id);
        setSeen(next);
        saveSeen(next);
    };

    const handleToggle = () => {
        setOpen((prev) => {
            const next = !prev;
            // Opening the popover marks everything currently in view as read.
            if (next) markAllRead();
            return next;
        });
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                type="button"
                onClick={handleToggle}
                aria-label="Notifications"
                className="relative w-10 h-10 flex items-center justify-center text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
                <i className="ri-notification-3-line text-xl"></i>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden z-40">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-gray-900">Notifications</p>
                            <p className="text-[11px] text-gray-500">
                                {loading ? 'Refreshing…' : items.length === 0 ? 'You\u2019re all caught up' : 'Last 7 days'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const next = new Set<string>();
                                setSeen(next);
                                saveSeen(next);
                            }}
                            className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
                            title="Reset which items are marked as read"
                        >
                            Clear read
                        </button>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto">
                        {items.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <i className="ri-check-double-line text-3xl text-emerald-300 block mb-2"></i>
                                <p className="text-sm font-semibold text-gray-700">Nothing to review.</p>
                                <p className="text-xs text-gray-500 mt-1">
                                    You\u2019ll see new paid orders, returns and low-stock alerts here.
                                </p>
                            </div>
                        ) : (
                            items.map((it) => {
                                const isUnread = !seen.has(it.id);
                                return (
                                    <Link
                                        key={it.id}
                                        href={it.href}
                                        onClick={() => setOpen(false)}
                                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-colors ${
                                            isUnread ? 'bg-emerald-50/40' : ''
                                        }`}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${it.accent}`}>
                                            <i className={`${it.icon} text-base`}></i>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{it.title}</p>
                                                {isUnread && (
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{it.message}</p>
                                            <p className="text-[11px] text-gray-400 mt-1">{timeAgo(it.createdAt)}</p>
                                        </div>
                                    </Link>
                                );
                            })
                        )}
                    </div>

                    {items.length > 0 && (
                        <Link
                            href="/admin/orders"
                            onClick={() => setOpen(false)}
                            className="block px-4 py-3 text-center text-xs font-semibold text-emerald-700 hover:bg-gray-50 border-t border-gray-100"
                        >
                            View all orders
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
