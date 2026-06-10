'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker at /sw.js once the page is interactive.
 *
 * Skipped in development to avoid the SW intercepting hot-reload requests.
 * The dev signal is `process.env.NODE_ENV === 'development'`, which Next
 * inlines at build time.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (process.env.NODE_ENV === 'development') return
    if (!('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          /* fall through silently — non-blocking */
        })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
