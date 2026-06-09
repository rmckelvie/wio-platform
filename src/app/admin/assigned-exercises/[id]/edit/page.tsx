import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { updateAssignedExercise } from '@/app/admin/weeks/[id]/actions'

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

interface AssignedExerciseRow {
  id: string
  prescribed_sets: string | null
  prescribed_reps: string | null
  notes: string | null
  rest_seconds: number | null
  work_interval_seconds: number | null
  exercises: { name: string; video_url: string | null } | null
  assigned_sections:
    | {
        section_type: string
        assigned_sessions:
          | { name: string; assignment_week_id: string }
          | { name: string; assignment_week_id: string }[]
          | null
      }
    | {
        section_type: string
        assigned_sessions:
          | { name: string; assignment_week_id: string }
          | { name: string; assignment_week_id: string }[]
          | null
      }[]
    | null
}

export default async function EditAssignedExercisePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data, error: fetchErr } = await supabase
    .from('assigned_exercises')
    .select(
      `
      id, prescribed_sets, prescribed_reps, notes,
      rest_seconds, work_interval_seconds,
      exercises ( name, video_url ),
      assigned_sections!inner (
        section_type,
        assigned_sessions!inner ( name, assignment_week_id )
      )
    `,
    )
    .eq('id', id)
    .single()

  if (fetchErr || !data) notFound()

  const ae = data as unknown as AssignedExerciseRow
  const section = Array.isArray(ae.assigned_sections)
    ? ae.assigned_sections[0]
    : ae.assigned_sections
  const session = Array.isArray(section?.assigned_sessions)
    ? section?.assigned_sessions[0]
    : section?.assigned_sessions
  const weekId = session?.assignment_week_id

  const action = updateAssignedExercise.bind(null, ae.id)

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={weekId ? `/admin/weeks/${weekId}` : '/admin'}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Week
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{ae.exercises?.name ?? 'Exercise'}</h1>
        <p className="text-sm text-muted-foreground">
          {session?.name}
        </p>
      </div>

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Prescribed sets</span>
            <input
              name="prescribed_sets"
              type="text"
              defaultValue={ae.prescribed_sets ?? ''}
              placeholder="e.g. 3"
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Prescribed reps</span>
            <input
              name="prescribed_reps"
              type="text"
              defaultValue={ae.prescribed_reps ?? ''}
              placeholder="e.g. 5, 6/6, 30s, max"
              className={inputClass}
            />
            <span className="text-xs text-muted-foreground">
              Free text — per-side notation, time, &quot;max&quot;, ranges all OK.
            </span>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={ae.notes ?? ''}
            placeholder="Per-row override of the exercise's default notes."
            className={inputClass}
          />
        </label>

        <fieldset className="rounded border border-border bg-card/40 p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Timing (optional)
          </legend>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Rest after set (s)</span>
              <input
                name="rest_seconds"
                type="number"
                inputMode="numeric"
                min={0}
                max={7200}
                step={5}
                defaultValue={ae.rest_seconds ?? ''}
                placeholder="e.g. 90"
                className={inputClass}
              />
              <span className="text-xs text-muted-foreground">
                Starts a countdown timer for the client after each set is
                logged. Leave blank for no auto-timer.
              </span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">EMOM interval (s)</span>
              <input
                name="work_interval_seconds"
                type="number"
                inputMode="numeric"
                min={5}
                max={7200}
                step={5}
                defaultValue={ae.work_interval_seconds ?? ''}
                placeholder="e.g. 60"
                className={inputClass}
              />
              <span className="text-xs text-muted-foreground">
                Every-minute-on-the-minute style. Each set must be completed
                within this many seconds. Number of cycles = prescribed sets.
              </span>
            </label>
          </div>
        </fieldset>

        {error && (
          <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit">Save</Button>
          <Link
            href={weekId ? `/admin/weeks/${weekId}` : '/admin'}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
