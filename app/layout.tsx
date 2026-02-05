import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL('https://standardstore.vercel.app'),
  title: {
    default: "Hy_stepper | Steps Ahead in Style",
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
    icon: '/sarahlawson.png', // Keeping the logo file for now if not provided new one, or should I leave it? User said "Change All Sarah Lawson Imports". I'll keep the filename if I don't have a new one but change the alt/branding text.
    apple: '/sarahlawson.png',
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://standardstore.vercel.app",
    title: "Hy_stepper | Steps Ahead in Style",
    description: "Premium footwear delivered to your doorstep. Online-only delivery service.",
    siteName: "Hy_stepper",
    images: [
      {
        url: "/sarah-lawson.jpeg",
        width: 1200,
        height: 630,
        alt: "Hy_stepper",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hy_stepper",
    description: "Premium footwear delivered to your doorstep.",
    images: ["/sarah-lawson.jpeg"],
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
        <link
          href="https://cdn.jsdelivr.net/npm/remixicon@4.1.0/fonts/remixicon.css"
          rel="stylesheet"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Pacifico&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
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
