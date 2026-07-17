'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useCMS } from '@/context/CMSContext';

declare global {
    interface Window {
        dataLayer: any[];
        gtag: (...args: any[]) => void;
        fbq: any;
        _fbq: any;
    }
}

// Injects Google Analytics 4 + Meta Pixel using the IDs configured in
// Admin → Settings → Tracking (store_settings: ga4_measurement_id /
// meta_pixel_id). Fires page_view / PageView on every route change.
export default function TrackingScripts() {
    const { getSetting } = useCMS();
    const pathname = usePathname();

    const ga4Id = (getSetting('ga4_measurement_id') || '').trim();
    const pixelId = (getSetting('meta_pixel_id') || '').trim();

    const ga4Loaded = useRef(false);
    const pixelLoaded = useRef(false);

    // Load GA4 once the measurement ID is known.
    useEffect(() => {
        if (!ga4Id || ga4Loaded.current) return;
        ga4Loaded.current = true;

        window.dataLayer = window.dataLayer || [];
        window.gtag = function gtag() {
            window.dataLayer.push(arguments);
        };
        window.gtag('js', new Date());
        window.gtag('config', ga4Id, { send_page_view: true });

        const script = document.createElement('script');
        script.async = true;
        script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`;
        document.head.appendChild(script);
    }, [ga4Id]);

    // Load Meta Pixel once the pixel ID is known.
    useEffect(() => {
        if (!pixelId || pixelLoaded.current) return;
        pixelLoaded.current = true;

        /* eslint-disable */
        (function (f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
            if (f.fbq) return;
            n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
            t = b.createElement(e); t.async = true; t.src = v;
            s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
        })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        /* eslint-enable */

        window.fbq('init', pixelId);
        window.fbq('track', 'PageView');
    }, [pixelId]);

    // Track SPA route changes.
    useEffect(() => {
        if (ga4Id && typeof window.gtag === 'function') {
            window.gtag('event', 'page_view', { page_path: pathname });
        }
        if (pixelId && typeof window.fbq === 'function') {
            window.fbq('track', 'PageView');
        }
    }, [pathname, ga4Id, pixelId]);

    return null;
}

// Helper other pages can call to record a purchase conversion.
export function trackPurchase(order: {
    orderNumber: string;
    total: number;
    currency?: string;
    items?: { name: string; quantity: number; price: number }[];
}) {
    try {
        if (typeof window === 'undefined') return;
        const currency = order.currency || 'GHS';
        if (typeof window.gtag === 'function') {
            window.gtag('event', 'purchase', {
                transaction_id: order.orderNumber,
                value: order.total,
                currency,
                items: (order.items || []).map(it => ({
                    item_name: it.name,
                    quantity: it.quantity,
                    price: it.price,
                })),
            });
        }
        if (typeof window.fbq === 'function') {
            window.fbq('track', 'Purchase', { value: order.total, currency });
        }
    } catch {
        // Tracking must never break the storefront.
    }
}
