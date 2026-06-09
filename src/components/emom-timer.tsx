'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  scheduleBeeps,
  restAlarmSpecs,
  type BeepSpec,
  type BeepHandle,
} from '@/lib/timer-sound'

/**
 * Fixed-interval (EMOM-style) work timer.
 *
 * - On Start (a user gesture), pre-schedules a single beep at each cycle
 *   boundary plus a 5-beep finish alarm. Audio is queued inside the
 *   AudioContext from within the gesture, so the chimes play at the right
 *   moments even without further taps.
 * - Stop / Reset cancels any pending beeps.
 * - State does not persist across navigation.
 */
export function EmomTimer({
  intervalSeconds,
  totalSets,
}: {
  intervalSeconds: number
  totalSets: number
}) {
  const totalDuration = intervalSeconds * totalSets
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const alarmHandleRef = useRef<BeepHandle | null>(null)

  const running = startedAt !== null && elapsedSec < totalDuration
  const finished = startedAt !== null && elapsedSec >= totalDuration

  // Visual tick driver — stops at totalDuration.
  useEffect(() => {
    if (!running || startedAt === null) return
    let cancelled = false
    const id = setInterval(() => {
      if (cancelled) return
      const next = (Date.now() - startedAt) / 1000
      if (next >= totalDuration) {
        cancelled = true
        clearInterval(id)
        setElapsedSec(totalDuration)
      } else {
        setElapsedSec(next)
      }
    }, 200)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [running, startedAt, totalDuration])

  // Cancel any audio on unmount
  useEffect(() => {
    return () => {
      alarmHandleRef.current?.cancel()
      alarmHandleRef.current = null
    }
  }, [])

  function start() {
    // Build a single batch of beeps:
    //  - one chime at the end of sets 1..N-1 (boundary into the next set)
    //  - 5-beep alarm at the end of the final set
    const beeps: BeepSpec[] = []
    for (let i = 1; i < totalSets; i++) {
      beeps.push({
        offsetSeconds: i * intervalSeconds,
        freq: 1320,
        duration: 0.18,
        volume: 0.28,
      })
    }
    beeps.push(...restAlarmSpecs(totalSets * intervalSeconds))

    alarmHandleRef.current?.cancel()
    alarmHandleRef.current = scheduleBeeps(beeps)

    setElapsedSec(0)
    setStartedAt(Date.now())
  }

  function reset() {
    alarmHandleRef.current?.cancel()
    alarmHandleRef.current = null
    setStartedAt(null)
    setElapsedSec(0)
  }

  if (startedAt === null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mb-3 w-full"
        onClick={start}
      >
        Start EMOM · {intervalSeconds}s × {totalSets} sets
      </Button>
    )
  }

  if (finished) {
    return (
      <div className="mb-3 rounded-lg border border-brand/60 bg-brand/15 p-4 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">
          EMOM complete
        </p>
        <p className="mt-1 text-sm text-foreground">
          {totalSets} × {intervalSeconds}s cycles done
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={reset}
        >
          Reset
        </Button>
      </div>
    )
  }

  const currentSetIndex = Math.min(
    totalSets - 1,
    Math.floor(elapsedSec / intervalSeconds),
  )
  const currentSet = currentSetIndex + 1
  const secInSet = elapsedSec - currentSetIndex * intervalSeconds
  const remainInSet = Math.max(0, intervalSeconds - secInSet)
  const mins = Math.floor(remainInSet / 60)
  const secs = Math.floor(remainInSet) % 60
  const progress = Math.max(
    0,
    Math.min(100, (secInSet / intervalSeconds) * 100),
  )

  return (
    <div className="mb-3 rounded-lg border border-brand/60 bg-brand/10 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">
          EMOM · set {currentSet} / {totalSets}
        </p>
        <Button type="button" variant="ghost" size="xs" onClick={reset}>
          Stop
        </Button>
      </div>
      <p className="mt-1 text-4xl font-semibold tabular-nums">
        {mins}:{secs.toString().padStart(2, '0')}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-brand transition-[width] duration-200 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
