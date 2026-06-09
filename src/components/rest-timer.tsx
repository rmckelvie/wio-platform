'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { playEndChime } from '@/lib/timer-sound'

/**
 * Countdown rest timer.
 *
 * Receives the duration (seconds) plus the timestamp at which it started
 * (typically the last logged set's `logged_at`). Computes remaining time
 * client-side so navigation away and back resumes correctly.
 */
export function RestTimer({
  totalSeconds,
  startedAtIso,
}: {
  totalSeconds: number
  startedAtIso: string
}) {
  const initialRemaining = computeRemaining(totalSeconds, startedAtIso)
  const [remaining, setRemaining] = useState(initialRemaining)
  const [dismissed, setDismissed] = useState(false)
  const chimedRef = useRef(false)
  const finished = remaining <= 0

  useEffect(() => {
    if (dismissed || finished) return

    let cancelled = false
    const id = setInterval(() => {
      if (cancelled) return
      const next = computeRemaining(totalSeconds, startedAtIso)
      if (next <= 0) {
        cancelled = true
        clearInterval(id)
        setRemaining(0)
      } else {
        setRemaining(next)
      }
    }, 250)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [dismissed, finished, totalSeconds, startedAtIso])

  // Chime once when we cross zero
  useEffect(() => {
    if (finished && !chimedRef.current) {
      chimedRef.current = true
      playEndChime()
    }
  }, [finished])

  if (dismissed) return null

  const display = formatMmSs(Math.max(0, remaining))
  const progress = Math.max(
    0,
    Math.min(100, ((totalSeconds - Math.max(0, remaining)) / totalSeconds) * 100),
  )

  return (
    <div
      className={`mb-3 rounded-lg border p-3 transition-colors ${
        finished
          ? 'border-brand/60 bg-brand/15'
          : 'border-border bg-background'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {finished ? 'Rest complete' : 'Rest'}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{display}</p>
        </div>
        <Button
          type="button"
          variant={finished ? 'outline' : 'ghost'}
          size="sm"
          onClick={() => setDismissed(true)}
        >
          {finished ? 'Dismiss' : 'Skip'}
        </Button>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-brand transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}

function computeRemaining(total: number, startedAtIso: string): number {
  const startMs = new Date(startedAtIso).getTime()
  if (!Number.isFinite(startMs)) return total
  const elapsedSec = Math.floor((Date.now() - startMs) / 1000)
  return total - elapsedSec
}

function formatMmSs(s: number): string {
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
