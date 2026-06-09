'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { playEndChime } from '@/lib/timer-sound'

/**
 * Fixed-interval (EMOM-style) work timer. Cycles `totalSets` times,
 * `intervalSeconds` per cycle. Plays a chime at every cycle boundary
 * and at the end of the last cycle.
 *
 * Pure client state — does not persist across navigation. Tap Start to
 * begin, Stop to abort.
 */
export function EmomTimer({
  intervalSeconds,
  totalSets,
}: {
  intervalSeconds: number
  totalSets: number
}) {
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [tick, setTick] = useState(0)
  const lastSetRef = useRef<number>(0)

  useEffect(() => {
    if (startedAt === null) return
    const id = setInterval(() => setTick((t) => t + 1), 200)
    return () => clearInterval(id)
  }, [startedAt])

  if (startedAt === null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={() => {
          lastSetRef.current = 0
          setStartedAt(Date.now())
        }}
      >
        Start EMOM · {intervalSeconds}s × {totalSets} sets
      </Button>
    )
  }

  const elapsedMs = Date.now() - startedAt
  const elapsedSec = elapsedMs / 1000
  const totalDuration = intervalSeconds * totalSets
  const finished = elapsedSec >= totalDuration

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

  // Chime when set boundary changes (and at finish)
  if (currentSet !== lastSetRef.current) {
    if (lastSetRef.current !== 0) {
      // Don't chime on the very first set (when timer first starts)
      playEndChime()
    }
    lastSetRef.current = currentSet
  }
  if (finished && lastSetRef.current !== -1) {
    playEndChime()
    lastSetRef.current = -1
  }
  // Reference tick so the linter doesn't strip the dependency
  void tick

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
          onClick={() => setStartedAt(null)}
        >
          Reset
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-3 rounded-lg border border-brand/60 bg-brand/10 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-brand">
          EMOM · set {currentSet} / {totalSets}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            setStartedAt(null)
            lastSetRef.current = 0
          }}
        >
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
