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
  const totalDuration = intervalSeconds * totalSets
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState(0)
  const lastSetBoundaryRef = useRef<number>(0)
  const finishedChimedRef = useRef(false)

  const running = startedAt !== null && elapsedSec < totalDuration

  // Tick driver — stops as soon as we reach totalDuration
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

  // Boundary chimes — once per new set, once at finish
  const currentSetIndex = Math.min(
    totalSets - 1,
    Math.floor(elapsedSec / intervalSeconds),
  )
  const currentSet = currentSetIndex + 1
  const finished = startedAt !== null && elapsedSec >= totalDuration

  useEffect(() => {
    if (startedAt === null) {
      lastSetBoundaryRef.current = 0
      finishedChimedRef.current = false
      return
    }
    if (
      currentSet !== lastSetBoundaryRef.current &&
      lastSetBoundaryRef.current !== 0
    ) {
      playEndChime()
    }
    lastSetBoundaryRef.current = currentSet
  }, [currentSet, startedAt])

  useEffect(() => {
    if (finished && !finishedChimedRef.current) {
      finishedChimedRef.current = true
      playEndChime()
    }
  }, [finished])

  if (startedAt === null) {
    return (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="mb-3 w-full"
        onClick={() => {
          setElapsedSec(0)
          setStartedAt(Date.now())
        }}
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
          onClick={() => {
            setStartedAt(null)
            setElapsedSec(0)
          }}
        >
          Reset
        </Button>
      </div>
    )
  }

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
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => {
            setStartedAt(null)
            setElapsedSec(0)
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
