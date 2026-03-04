import type { Metadata } from "next";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import "./globals.css";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hystepper.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Hy_stepper | Stay Sleek in Style",
    template: "%s | Hy_stepper"
  },
  description: "Premium footwear & accessories for the modern woman. Shop heels, sneakers, bags and more — with fast delivery across Ghana.",
  keywords: [
    "Hy_stepper", "women's shoes Ghana", "heels Accra", "sneakers Ghana",
    "buy shoes online Ghana", "premium footwear Ghana", "ladies bags Accra",
    "fashion accessories Ghana", "online shoe store Ghana", "delivery Accra"
  ],
  authors: [{ name: "Hy_stepper" }],
  creator: "Hy_stepper",
  publisher: "Hy_stepper",
  category: "Shopping",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: SITE_URL,
    title: "Hy_stepper | Stay Sleek in Style",
    description: "Premium footwear & accessories for the modern woman. Shop heels, sneakers, bags and more — with fast delivery across Ghana.",
    siteName: "Hy_stepper",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Hy_stepper — Stay Sleek in Style",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hy_stepper | Stay Sleek in Style",
    description: "Premium footwear & accessories for the modern woman. Fast delivery across Ghana.",
    images: ["/opengraph-image"],
    creator: "@hystepper",
  },
};

// Site-wide structured data injected on every page
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Hy_stepper",
  url: SITE_URL,
  logo: `${SITE_URL}/opengraph-image`,
  description: "Premium footwear & accessories for the modern woman. Fast delivery across Ghana.",
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+233276558163",
    contactType: "Customer Service",
    areaServed: "GH",
    availableLanguage: ["English"],
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Accra",
    addressCountry: "GH",
  },
  sameAs: [
    "https://instagram.com/hystepper",
    "https://facebook.com/hystepper",
    "https://twitter.com/hystepper",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Hy_stepper",
  url: SITE_URL,
  description: "Premium footwear & accessories for the modern woman.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/shop?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GH">
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
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
