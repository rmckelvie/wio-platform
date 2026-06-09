'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { scheduleBeeps, restAlarmSpecs } from '@/lib/timer-sound'

/**
 * Countdown rest timer.
 *
 * - Uses the most-recent log's timestamp as the start anchor, so navigation
 *   away and back resumes at the correct point.
 * - PRE-SCHEDULES the end-of-rest alarm into the AudioContext as soon as
 *   it mounts (which is right after the user's "Log set" tap). The alarm
 *   then plays at the right time without further interaction.
 * - If the timer is already finished when this component mounts (e.g. the
 *   client revisited the page after rest had ended), no alarm is scheduled
 *   — so no rogue chimes on navigation.
 * - The alarm is 5 short beeps over ~4 seconds, then silence. Skip /
 *   Dismiss cancels any pending beeps.
 */
export function RestTimer({
  totalSeconds,
  startedAtIso,
}: {
  totalSeconds: number
  startedAtIso: string
}) {
  const [remaining, setRemaining] = useState(() =>
    computeRemaining(totalSeconds, startedAtIso),
  )
  const [dismissed, setDismissed] = useState(false)
  const finished = remaining <= 0

  // Pre-schedule the alarm at mount. If the timer is already past zero
  // (= a revisit after a long absence) skip — we do NOT want a chime here.
  useEffect(() => {
    const offsetMs =
      new Date(startedAtIso).getTime() + totalSeconds * 1000 - Date.now()
    if (offsetMs <= 0) return
    const handle = scheduleBeeps(restAlarmSpecs(offsetMs / 1000))
    return () => handle.cancel()
  }, [totalSeconds, startedAtIso])

  // Tick driver for the visual countdown — stops the moment we cross zero.
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

  if (dismissed) return null

  const display = formatMmSs(Math.max(0, remaining))
  const progress = Math.max(
    0,
    Math.min(
      100,
      ((totalSeconds - Math.max(0, remaining)) / totalSeconds) * 100,
    ),
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
