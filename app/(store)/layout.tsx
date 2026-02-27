'use client';

import dynamic from 'next/dynamic';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import { CMSProvider } from '@/context/CMSContext';

const CookieConsent = dynamic(() => import('@/components/CookieConsent'), { ssr: false });
const WhatsAppButton = dynamic(() => import('@/components/WhatsAppButton'), { ssr: false });
const OfflineIndicator = dynamic(() => import('@/components/OfflineIndicator'), { ssr: false });

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CMSProvider>
      <div className="min-h-screen bg-gray-50">
        <Header />
        {children}
        <Footer />
        <MobileBottomNav />
        <OfflineIndicator />
        <CookieConsent />
        <WhatsAppButton />
      </div>
    </CMSProvider>
  );
}
