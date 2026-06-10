'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface ExistingMetric {
  weight_kg: number | null
  sleep_hours: number | null
  energy: number | null
  notes: string | null
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

/**
 * Today's check-in form. Pre-filled if a record already exists for today.
 *
 * Wraps the server `saveMetric` action so that "form open" stays a piece
 * of client state — once submitted we leave it visible (with the just-saved
 * values) because clients often want to tweak weight a few minutes later
 * (e.g. after another scale read).
 */
export function MetricsTracker({
  action,
  today,
  existing,
}: {
  action: (formData: FormData) => void | Promise<void>
  today: string
  existing: ExistingMetric | null
}) {
  const [open, setOpen] = useState(!existing)

  if (!open) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
              Today&apos;s check-in
            </p>
            <p className="mt-1 text-sm">
              <span className="text-brand">✓ Logged.</span>{' '}
              {summarise(existing!)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(true)}
          >
            Edit
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Today&apos;s check-in
      </p>
      <input type="hidden" name="measured_on" value={today} />

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Weight (kg)</span>
          <input
            name="weight_kg"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            placeholder="—"
            defaultValue={existing?.weight_kg ?? ''}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Sleep (hrs)</span>
          <input
            name="sleep_hours"
            type="number"
            inputMode="decimal"
            step="0.5"
            min={0}
            max={24}
            placeholder="—"
            defaultValue={existing?.sleep_hours ?? ''}
            className={inputClass}
          />
        </label>
      </div>

      <fieldset>
        <legend className="text-xs text-muted-foreground">Energy (1–5)</legend>
        <div className="mt-1 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-input bg-background text-base font-medium tabular-nums hover:border-brand/60 has-[:checked]:border-brand has-[:checked]:bg-brand/15 has-[:checked]:text-brand"
            >
              <input
                type="radio"
                name="energy"
                value={n}
                defaultChecked={existing?.energy === n}
                className="sr-only"
              />
              {n}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Notes (optional)</span>
        <textarea
          name="notes"
          rows={2}
          placeholder="Anything to flag — soreness, stress, late night..."
          defaultValue={existing?.notes ?? ''}
          className={inputClass}
        />
      </label>

      <div className="flex items-center gap-2">
        <Button type="submit" size="lg" className="flex-1">
          Save check-in
        </Button>
        {existing && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function summarise(m: ExistingMetric): string {
  const parts: string[] = []
  if (m.weight_kg !== null)
    parts.push(`${trimNumber(m.weight_kg.toString())}kg`)
  if (m.sleep_hours !== null)
    parts.push(`${trimNumber(m.sleep_hours.toString())}h sleep`)
  if (m.energy !== null) parts.push(`energy ${m.energy}/5`)
  return parts.length ? parts.join(' · ') : 'No values entered.'
}

function trimNumber(s: string): string {
  return Number.parseFloat(s).toString()
}
