/* WIO service worker — minimal.
 *
 * Purpose v1: satisfy the installability criteria so Chrome / Edge show
 * "Add to Home Screen", and let iOS treat the site as a PWA in
 * standalone mode after the user installs it via Share → Add to Home
 * Screen.
 *
 * No offline data caching for now — this is a server-rendered app where
 * each page is dynamic and depends on Supabase auth cookies. Trying to
 * cache pages aggressively would just show stale content. We DO cache
 * the brand assets so the splash + icon load instantly.
 */

const VERSION = 'wio-v3'
const STATIC_ASSETS = [
  '/wio-mark.png',
  '/wio-wordmark.png',
  '/wio-icon-wordmark.png',
  '/icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        cache.addAll(STATIC_ASSETS).catch(() => {
          // silently ignore — install must not fail
        }),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== VERSION)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  // Cache-first for the small set of brand assets; everything else goes
  // straight to the network so we never serve stale auth-gated content.
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(event.request)
        .then((cached) => cached || fetch(event.request)),
    )
  }
})
