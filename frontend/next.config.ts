import type { NextConfig } from 'next';

// Inspection photos are served by the backend's /uploads; next/image resizes them into thumbnails
const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000');
// Next 16 refuses to optimise images from local/private addresses unless allowed; only do that
// when the API itself runs on one (local development or an on-premises install)
const apiIsLocal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/.test(apiUrl.hostname);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: apiUrl.hostname,
        port: apiUrl.port,
        pathname: '/uploads/**',
      },
    ],
    dangerouslyAllowLocalIP: apiIsLocal,
    formats: ['image/avif', 'image/webp'],
    // uploads have unique names and never change, so resized copies can be kept for a month
    minimumCacheTTL: 2678400,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      {
        // app icons are not content-hashed, so cache for a week and revalidate in the background
        source: '/:icon(icon-\\d+\\.png)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }],
      },
      {
        // the service worker must never be cached, so updates reach officers immediately
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
