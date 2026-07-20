import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
      {
        protocol: 'https',
        hostname: 'hystepper.com',
      },
      {
        protocol: 'https',
        hostname: 'www.hystepper.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Auth route aliases. The real pages live under /auth/*, but links (header,
  // admin-configured CTAs like the welcome popup) sometimes use the shorter
  // conventional paths. Redirect them so none dead-end on a 404.
  async redirects() {
    return [
      { source: "/sign-up", destination: "/auth/signup", permanent: false },
      { source: "/signup", destination: "/auth/signup", permanent: false },
      { source: "/register", destination: "/auth/signup", permanent: false },
      { source: "/sign-in", destination: "/auth/login", permanent: false },
      { source: "/signin", destination: "/auth/login", permanent: false },
      { source: "/login", destination: "/auth/login", permanent: false },
      { source: "/forgot-password", destination: "/auth/forgot-password", permanent: false },
      { source: "/reset-password", destination: "/auth/reset-password", permanent: false },
    ];
  },
};

export default nextConfig;
