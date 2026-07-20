'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';

const DISMISS_KEY = 'hy_welcome_popup_dismissed';

// Optional welcome popup, fully managed from Admin → Settings → Popup.
// Settings used (store_settings):
//   welcome_popup_enabled       'true' | 'false'
//   welcome_popup_title         heading text
//   welcome_popup_message       body text
//   welcome_popup_image         optional image URL
//   welcome_popup_button_text   CTA label
//   welcome_popup_button_link   CTA href
//   welcome_popup_delay_seconds seconds before the popup shows (default 3)
//   welcome_popup_frequency     'once' (default) | 'daily' | 'always'
export default function WelcomePopup() {
    const { getSetting } = useCMS();
    const [visible, setVisible] = useState(false);

    const enabled = getSetting('welcome_popup_enabled') === 'true';
    const title = getSetting('welcome_popup_title');
    const message = getSetting('welcome_popup_message');
    const image = getSetting('welcome_popup_image');
    const buttonText = getSetting('welcome_popup_button_text');
    // Trim — a pasted trailing space turns the URL into e.g. "/auth/signup%20" (404)
    const buttonLink = (getSetting('welcome_popup_button_link') || '').trim() || '/shop';
    const delaySeconds = Math.max(0, Number(getSetting('welcome_popup_delay_seconds')) || 3);
    const frequency = getSetting('welcome_popup_frequency') || 'once';

    useEffect(() => {
        if (!enabled || (!title && !message)) return;

        try {
            const dismissedAt = localStorage.getItem(DISMISS_KEY);
            if (dismissedAt) {
                if (frequency === 'once') return;
                if (frequency === 'daily' && Date.now() - Number(dismissedAt) < 24 * 60 * 60 * 1000) return;
            }
        } catch { /* localStorage unavailable — just show */ }

        const timer = setTimeout(() => setVisible(true), delaySeconds * 1000);
        return () => clearTimeout(timer);
    }, [enabled, title, message, delaySeconds, frequency]);

    const dismiss = () => {
        setVisible(false);
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch { /* ignore */ }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={dismiss}
                aria-hidden="true"
            />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                <button
                    onClick={dismiss}
                    className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 shadow text-gray-500 hover:text-gray-900 transition-colors"
                    aria-label="Close popup"
                >
                    <i className="ri-close-line text-xl"></i>
                </button>

                {image && (
                    <div className="w-full aspect-[16/9] bg-gray-100 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image} alt={title || 'Welcome'} className="w-full h-full object-cover" />
                    </div>
                )}

                <div className="p-6 sm:p-8 text-center">
                    {title && (
                        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-gray-900 mb-3">{title}</h2>
                    )}
                    {message && (
                        <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-6 whitespace-pre-line">{message}</p>
                    )}
                    {buttonText && (
                        <Link
                            href={buttonLink}
                            onClick={dismiss}
                            className="inline-block px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-semibold text-sm tracking-wide transition-colors"
                        >
                            {buttonText}
                        </Link>
                    )}
                    <button
                        onClick={dismiss}
                        className="block mx-auto mt-4 text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                    >
                        No thanks, continue browsing
                    </button>
                </div>
            </div>
        </div>
    );
}
