import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hystepper.vercel.app';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/account/',
          '/checkout/',
          '/api/',
          '/order-success',
          '/order-failed',
          '/auth/',
          '/maintenance',
          '/offline',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: '/',
        disallow: [
          '/admin/',
          '/account/',
          '/checkout/',
          '/api/',
          '/order-success',
          '/order-failed',
          '/auth/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
