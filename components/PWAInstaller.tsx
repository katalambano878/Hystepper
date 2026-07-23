'use client';

import { useEffect, useState } from 'react';

export default function PWAInstaller() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstallation = () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };

    checkInstallation();

    const handler = (e: any) => {
      e.preventDefault();
      setSupportsPWA(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(async (registration) => {
          // Force an update check so phones pick up cache-busting SW builds.
          try {
            await registration.update();
          } catch {
            /* ignore */
          }
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_CACHE' });
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  return null;
}