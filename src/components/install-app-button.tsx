'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Platform = 'ios' | 'android' | 'desktop' | 'unknown'

/**
 * Some browsers (Chrome / Edge / Android) expose the install prompt via
 * the `beforeinstallprompt` event. iOS Safari never fires it — installing
 * is a manual Share → Add to Home Screen flow there.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallAppButton() {
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [isStandalone, setIsStandalone] = useState(false)
  const [open, setOpen] = useState(false)
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Detect "already installed" — running in standalone display mode
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true
    setIsStandalone(standalone)

    // Cheap UA-based platform detection
    const ua = window.navigator.userAgent.toLowerCase()
    if (/iphone|ipad|ipod/.test(ua)) setPlatform('ios')
    else if (/android/.test(ua)) setPlatform('android')
    else setPlatform('desktop')

    const handler = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (isStandalone) return null

  async function handleClick() {
    if (promptEvent) {
      // Native install prompt — Android Chrome / desktop Chrome / Edge
      await promptEvent.prompt()
      await promptEvent.userChoice.catch(() => {})
      setPromptEvent(null)
    } else {
      setOpen((o) => !o)
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="gap-2"
      >
        <span aria-hidden>📲</span>
        {promptEvent ? 'Install app' : open ? 'Hide instructions' : 'Install app'}
      </Button>

      {open && !promptEvent && (
        <div className="rounded-lg border border-border bg-card p-3 text-sm">
          <Instructions platform={platform} />
        </div>
      )}
    </div>
  )
}

function Instructions({ platform }: { platform: Platform }) {
  if (platform === 'ios') {
    return (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          iOS · Safari
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-sm">
          <li>
            Open this page in <span className="font-medium">Safari</span>{' '}
            (other browsers can&apos;t install).
          </li>
          <li>
            Tap the <span className="font-medium">Share</span> button at the
            bottom (square with an up arrow).
          </li>
          <li>
            Scroll down and tap{' '}
            <span className="font-medium">Add to Home Screen</span>.
          </li>
          <li>Tap Add to confirm. WIO will appear on your home screen.</li>
        </ol>
      </div>
    )
  }
  if (platform === 'android') {
    return (
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Android · Chrome
        </p>
        <ol className="ml-4 list-decimal space-y-1 text-sm">
          <li>
            Tap the menu <span className="font-medium">⋮</span> in the top
            right of Chrome.
          </li>
          <li>
            Tap <span className="font-medium">Install app</span> (or{' '}
            <span className="font-medium">Add to Home Screen</span>).
          </li>
          <li>Confirm. WIO will appear on your home screen.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Some phones show an install banner along the bottom of Chrome —
          tapping that works too.
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Desktop
      </p>
      <ol className="ml-4 list-decimal space-y-1 text-sm">
        <li>
          In Chrome or Edge, look for the install icon (⊕ / small monitor) at
          the right of the address bar.
        </li>
        <li>Click it and confirm Install.</li>
      </ol>
      <p className="text-xs text-muted-foreground">
        Or, the workout view is mainly designed for phones — installing on a
        phone is the better experience.
      </p>
    </div>
  )
}
