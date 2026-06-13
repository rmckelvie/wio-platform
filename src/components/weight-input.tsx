'use client'

import { useState } from 'react'

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-3 text-base tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

/**
 * Weight input with +/- step buttons and a smart default pre-fill.
 *
 * - Controlled internally so the +/- buttons can mutate the value.
 * - The hidden `<input name="weight_kg">` posts the value with the
 *   surrounding form, so the existing server action signature works
 *   unchanged.
 * - useState seeds from `defaultValue` once on mount. After a set is
 *   logged the page re-renders, but state persists (so for straight
 *   sets the next set already shows the same weight; user just hits
 *   Log).
 */
export function WeightInput({
  defaultValue,
  name = 'weight_kg',
}: {
  defaultValue: number | null
  name?: string
}) {
  const [value, setValue] = useState<string>(
    defaultValue !== null
      ? Number.parseFloat(defaultValue.toString()).toString()
      : '',
  )

  function adjust(delta: number) {
    const current = Number.parseFloat(value || '0')
    const next = Math.max(0, current + delta)
    // Round to 1 decimal so 0.5kg increments don't accumulate float noise
    const rounded = Math.round(next * 10) / 10
    setValue(rounded.toString())
  }

  return (
    <div className="space-y-1.5">
      <input
        name={name}
        type="number"
        inputMode="decimal"
        step="0.5"
        min={0}
        placeholder="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={inputClass}
      />
      <div className="grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={() => adjust(-5)}
          className="h-10 rounded-md border border-border bg-card text-sm font-medium tabular-nums active:bg-secondary"
        >
          −5
        </button>
        <button
          type="button"
          onClick={() => adjust(-2.5)}
          className="h-10 rounded-md border border-border bg-card text-sm font-medium tabular-nums active:bg-secondary"
        >
          −2.5
        </button>
        <button
          type="button"
          onClick={() => adjust(2.5)}
          className="h-10 rounded-md border border-border bg-card text-sm font-medium tabular-nums active:bg-secondary"
        >
          +2.5
        </button>
        <button
          type="button"
          onClick={() => adjust(5)}
          className="h-10 rounded-md border border-border bg-card text-sm font-medium tabular-nums active:bg-secondary"
        >
          +5
        </button>
      </div>
    </div>
  )
}
