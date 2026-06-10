import type { MetadataRoute } from 'next'

/**
 * Web App Manifest. Served at /manifest.webmanifest by Next.js.
 * Enables "Add to Home Screen" / Chrome install prompt with a
 * branded splash and standalone display mode.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'WIO — Work It Out',
    short_name: 'WIO',
    description: 'Personal training, programmed for you.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#000000',
    theme_color: '#000000',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      {
        src: '/wio-icon-wordmark.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/wio-icon-wordmark.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/wio-icon-wordmark.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
