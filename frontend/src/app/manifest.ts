import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pramiti · Legal Metrology Compliance Portal',
    short_name: 'Pramiti',
    description: 'AI-assisted inspection of pre-packaged commodity labels under the Legal Metrology (Packaged Commodities) Rules, 2011.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#faf6ee',
    theme_color: '#22305e',
    lang: 'en-IN',
    categories: ['government', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
