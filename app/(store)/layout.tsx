'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileBottomNav from '@/components/MobileBottomNav';
import SessionTimeoutWarning from '@/components/SessionTimeoutWarning';
// import PWAPrompt from '@/components/PWAPrompt';
// import PWAInstaller from '@/components/PWAInstaller';
import PushNotificationManager from '@/components/PushNotificationManager';
import OfflineIndicator from '@/components/OfflineIndicator';
import NetworkStatusMonitor from '@/components/NetworkStatusMonitor';
import UpdatePrompt from '@/components/UpdatePrompt';
import LiveSalesNotification from '@/components/LiveSalesNotification';
import FlashSaleBanner from '@/components/FlashSaleBanner';

import CookieConsent from '@/components/CookieConsent';
import WhatsAppButton from '@/components/WhatsAppButton';
import { CMSProvider } from '@/context/CMSContext';

export default function StoreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CMSProvider>
      <div className="min-h-screen bg-gray-50">
        {/* <PWAInstaller /> */}
        <Header />
        {children}
        <Footer />
        <MobileBottomNav />
        <SessionTimeoutWarning />
        {/* <PWAPrompt /> */}
        <PushNotificationManager />
        <OfflineIndicator />
        <NetworkStatusMonitor />
        <UpdatePrompt />
        <LiveSalesNotification />

        <CookieConsent />
        <WhatsAppButton />
      </div>
    </CMSProvider>
  );
}
