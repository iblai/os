import type { MetadataRoute } from 'next';

import { DEFAULT_DESCRIPTION, SITE_NAME } from '@/lib/seo';

/**
 * Served at `/manifest.webmanifest`. Next.js prefixes icon/start URLs with the
 * configured `basePath` automatically. The app already registers a service
 * worker (public/sw.js), so this completes the installable-PWA setup.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563EB',
    icons: [
      {
        src: '/favicon.png',
        sizes: 'any',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/iblai-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
