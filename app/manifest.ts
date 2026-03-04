import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hy_stepper',
    short_name: 'Hy_stepper',
    description: 'Premium footwear & accessories for the modern woman. Stay Sleek in Style.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0f0800',
    theme_color: '#dc9527',
    categories: ['shopping', 'lifestyle'],
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'apple touch icon',
      },
      {
        src: '/opengraph-image',
        sizes: '1200x630',
        type: 'image/png',
      },
    ],
    screenshots: [
      {
        src: '/opengraph-image',
        sizes: '1200x630',
        type: 'image/png',
      },
    ],
  };
}
