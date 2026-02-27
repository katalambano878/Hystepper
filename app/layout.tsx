import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://standardstore.vercel.app'),
  title: {
    default: "Hy_stepper | Stay sleek in style",
    template: "%s | Hy_stepper"
  },
  description: "Premium footwear delivered to your doorstep. Online-only delivery service.",
  keywords: ["Hy_stepper", "Footwear", "Shoes", "Heels", "Online Store", "Accra", "Delivery"],
  authors: [{ name: "Hy_stepper Team" }],
  creator: "Hy_stepper",
  publisher: "Hy_stepper",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: '/logo-new.png',
    apple: '/logo-new.png',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://standardstore.vercel.app",
    title: "Hy_stepper | Stay sleek in style",
    description: "Premium footwear delivered to your doorstep. Online-only delivery service.",
    siteName: "Hy_stepper",
    images: [
      {
        url: "/hero-footwear.png",
        width: 1200,
        height: 630,
        alt: "Hy_stepper - Premium Footwear",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hy_stepper",
    description: "Premium footwear delivered to your doorstep.",
    images: ["/hero-footwear.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rwsentatgbmxlfaecnqm.supabase.co" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.5.0/fonts/remixicon.min.css"
          rel="stylesheet"
        />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased font-sans overflow-x-hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[10000] focus:px-6 focus:py-3 focus:bg-emerald-700 focus:text-white focus:rounded-lg focus:font-semibold focus:shadow-lg"
        >
          Skip to main content
        </a>
        <CartProvider>
          <WishlistProvider>
            <div id="main-content">
              {children}
            </div>
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
