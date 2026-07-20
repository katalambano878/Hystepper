'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Banner {
    id: string;
    title: string;
    subtitle?: string;
    background_color: string;
    text_color: string;
    button_text?: string;
    button_url?: string;
}

export default function AnnouncementBar() {
    const [banners, setBanners] = useState<Banner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const [shouldScroll, setShouldScroll] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchBanners();
    }, []);

    useEffect(() => {
        // Auto-rotate banners if multiple
        if (banners.length > 1) {
            const interval = setInterval(() => {
                setCurrentIndex((prev) => (prev + 1) % banners.length);
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [banners.length]);

    const BANNER_CACHE_KEY = 'hy_banners';
    const BANNER_CACHE_TTL = 5 * 60 * 1000;

    const fetchBanners = async () => {
        try {
            const cached = sessionStorage.getItem(BANNER_CACHE_KEY);
            if (cached) {
                const { data: cachedData, ts } = JSON.parse(cached);
                if (Date.now() - ts < BANNER_CACHE_TTL) {
                    setBanners(cachedData);
                    return;
                }
            }
        } catch {}

        try {
            const now = new Date().toISOString();

            const { data, error } = await supabase
                .from('banners')
                .select('id, title, subtitle, background_color, text_color, button_text, button_url')
                .eq('is_active', true)
                .eq('position', 'top')
                .or(`start_date.is.null,start_date.lte.${now}`)
                .or(`end_date.is.null,end_date.gte.${now}`)
                .order('sort_order', { ascending: true });

            if (error) {
                console.log('Banners table may not exist yet');
                return;
            }

            setBanners(data || []);
            try {
                sessionStorage.setItem(BANNER_CACHE_KEY, JSON.stringify({ data: data || [], ts: Date.now() }));
            } catch {}
        } catch (error) {
            console.error('Error fetching banners:', error);
        }
    };

    const dismissBanner = (id: string) => {
        const newDismissed = new Set(dismissed);
        newDismissed.add(id);
        setDismissed(newDismissed);

        // Move to next banner if available
        const remainingBanners = banners.filter(b => !newDismissed.has(b.id));
        if (remainingBanners.length > 0) {
            setCurrentIndex(0);
        }
    };

    const visibleBanners = banners.filter(b => !dismissed.has(b.id));

    // Scroll (marquee) whenever the banner text is too wide to fit — this is
    // what makes long announcements move on mobile like they used to.
    useEffect(() => {
        const check = () => {
            const container = containerRef.current;
            const content = contentRef.current;
            if (!container || !content) return;
            setShouldScroll(content.scrollWidth > container.clientWidth);
        };
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [banners, currentIndex, dismissed]);

    if (visibleBanners.length === 0) {
        // Show default banner if no custom banners
        return (
            <div className="bg-gray-900 text-white py-2 text-center text-sm">
                <p>Shop Premium Footwear — Nationwide Delivery Available</p>
            </div>
        );
    }

    const currentBanner = visibleBanners[currentIndex % visibleBanners.length];

    const bannerContent = (hidden = false) => (
        <span
            aria-hidden={hidden}
            className="inline-flex items-center gap-4 whitespace-nowrap"
        >
            <span className="font-medium">
                {currentBanner.title}
                {currentBanner.subtitle && (
                    <span className="opacity-90 ml-2">{currentBanner.subtitle}</span>
                )}
            </span>
            {currentBanner.button_text && currentBanner.button_url && (
                <Link
                    href={currentBanner.button_url}
                    tabIndex={hidden ? -1 : undefined}
                    className="px-3 py-1 rounded-full text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{
                        backgroundColor: currentBanner.text_color,
                        color: currentBanner.background_color,
                    }}
                >
                    {currentBanner.button_text}
                </Link>
            )}
        </span>
    );

    return (
        <div
            className="py-2 px-4 text-center text-sm relative transition-colors duration-500 overflow-hidden"
            style={{
                backgroundColor: currentBanner.background_color,
                color: currentBanner.text_color,
            }}
        >
            <div ref={containerRef} className="max-w-7xl mx-auto overflow-hidden pl-8 pr-8">
                {/* Invisible copy used only to measure whether the text overflows */}
                <div ref={contentRef} aria-hidden className="absolute invisible whitespace-nowrap h-0 overflow-hidden">
                    {bannerContent(true)}
                </div>

                {shouldScroll ? (
                    <div
                        key={`${currentBanner.id}-marquee`}
                        className="flex w-max animate-marquee"
                        style={{ ['--marquee-duration' as any]: `${Math.max(14, Math.round((currentBanner.title.length + (currentBanner.subtitle?.length || 0)) / 3))}s` }}
                    >
                        <span className="pr-16">{bannerContent()}</span>
                        <span className="pr-16">{bannerContent(true)}</span>
                    </div>
                ) : (
                    <div key={currentBanner.id} className="flex items-center justify-center gap-4 animate-fade-in">
                        {bannerContent()}
                    </div>
                )}
            </div>

            {/* Dismiss button */}
            <button
                onClick={() => dismissBanner(currentBanner.id)}
                className="absolute right-4 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: currentBanner.text_color }}
                aria-label="Dismiss banner"
            >
                <i className="ri-close-line"></i>
            </button>

            {/* Dots indicator for multiple banners */}
            {visibleBanners.length > 1 && (
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex gap-1">
                    {visibleBanners.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`w-1.5 h-1.5 rounded-full transition-opacity ${idx === currentIndex % visibleBanners.length ? 'opacity-100' : 'opacity-40'
                                }`}
                            style={{ backgroundColor: currentBanner.text_color }}
                            aria-label={`Go to banner ${idx + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
