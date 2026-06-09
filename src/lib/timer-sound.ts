'use client'

export interface BeepSpec {
  /** Seconds from now (when this function is called) until the beep fires. */
  offsetSeconds: number
  /** Tone in Hz. Default 880. */
  freq?: number
  /** Beep length in seconds. Default 0.2. */
  duration?: number
  /** Peak gain 0-1. Default 0.3. */
  volume?: number
}

export interface BeepHandle {
  /** Stop any not-yet-played beeps; close the AudioContext. */
  cancel: () => void
}

/**
 * Pre-schedule a series of beeps into a single AudioContext.
 *
 * Works around iOS Safari's audio gating: as long as this function is
 * called from within a user-activation chain (e.g. shortly after a
 * "Log set" tap), the AudioContext is created in `running` state and
 * the scheduled beeps will play at their scheduled times even though
 * the user activation window has long since closed.
 *
 * Returns a handle so the caller can cancel pending beeps (e.g. when
 * the user dismisses the timer early).
 *
 * Vibration is fired immediately for the **first** beep that lands in
 * the future, because navigator.vibrate has no scheduling primitive.
 * Subsequent vibrations are wired up via setTimeout — only works if the
 * tab is in the foreground at that time.
 */
export function scheduleBeeps(beeps: BeepSpec[]): BeepHandle {
  if (typeof window === 'undefined') return noop
  const Ctx =
    window.AudioContext ||
    (
      window as unknown as {
        webkitAudioContext?: typeof AudioContext
      }
    ).webkitAudioContext
  if (!Ctx) return noop

  let ctx: AudioContext
  try {
    ctx = new Ctx()
  } catch {
    return noop
  }

  const startTime = ctx.currentTime
  const oscillators: OscillatorNode[] = []
  const vibrationTimers: number[] = []
  let maxOffset = 0

  for (const spec of beeps) {
    const offset = Math.max(0, spec.offsetSeconds)
    if (offset > maxOffset) maxOffset = offset
    const freq = spec.freq ?? 880
    const duration = spec.duration ?? 0.2
    const volume = spec.volume ?? 0.3

    const t = startTime + offset
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = freq

    // Quick attack/release envelope to avoid clicks
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    osc.start(t)
    osc.stop(t + duration + 0.05)
    oscillators.push(osc)

    // Best-effort vibration
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      const id = window.setTimeout(() => {
        try {
          navigator.vibrate?.(180)
        } catch {
          /* ignore */
        }
      }, Math.round(offset * 1000))
      vibrationTimers.push(id)
    }
  }

  // Auto-close context shortly after the last beep, to free resources.
  const closeAtMs = Math.ceil(maxOffset * 1000) + 2000
  const closeTimer = window.setTimeout(() => {
    try {
      ctx.close()
    } catch {
      /* ignore */
    }
  }, closeAtMs)

  let cancelled = false
  return {
    cancel: () => {
      if (cancelled) return
      cancelled = true
      for (const osc of oscillators) {
        try {
          osc.stop()
        } catch {
          /* already stopped */
        }
      }
      for (const id of vibrationTimers) clearTimeout(id)
      clearTimeout(closeTimer)
      try {
        ctx.close()
      } catch {
        /* ignore */
      }
    },
  }
}

const noop: BeepHandle = { cancel: () => {} }

/** Generates the 5-beep "rest finished" alarm starting at `offsetSeconds`. */
export function restAlarmSpecs(offsetSeconds: number): BeepSpec[] {
  return Array.from({ length: 5 }, (_, i) => ({
    offsetSeconds: offsetSeconds + i,
    freq: 880,
    duration: 0.18,
    volume: 0.3,
  }))
}
