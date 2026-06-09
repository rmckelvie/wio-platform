'use client'

/**
 * Plays a short tone + triggers a vibration (where supported).
 * Best-effort: silently no-ops if AudioContext or Vibration are unavailable.
 *
 * iOS Safari only allows audio after a user gesture. As long as the call
 * happens in a chain originating from a tap, it works.
 */
export function playEndChime() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    const ctx = new Ctx()
    const now = ctx.currentTime

    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ctx.destination)
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.25, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.start(now + start)
      osc.stop(now + start + dur + 0.05)
    }

    beep(880, 0, 0.15)
    beep(1320, 0.15, 0.25)
  } catch {
    // ignore
  }

  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.([180, 80, 180])
    }
  } catch {
    // ignore
  }
}
