import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'
import { sectionLabel, type SectionType } from '@/lib/sections'
import { parseMaxSets } from '@/lib/prescription'
import { logSet, deleteLog } from './actions'

interface ExerciseLog {
  id: string
  set_number: number
  weight_kg: number | null
  reps_done: number | null
  rpe: number | null
  notes: string | null
  logged_at: string
}

interface AssignedExercise {
  id: string
  order_index: number
  prescribed_sets: string | null
  prescribed_reps: string | null
  notes: string | null
  exercises: {
    id: string
    name: string
    video_url: string | null
    default_notes: string | null
  } | null
  exercise_logs: ExerciseLog[]
}

interface AssignedSection {
  id: string
  order_index: number
  section_type: SectionType
  assigned_exercises: AssignedExercise[]
}

interface SessionData {
  id: string
  session_index: number
  name: string
  assignment_weeks: {
    week_index: number
    name: string | null
    client_assignments: {
      id: string
      name: string
      weeks: number
    } | null
  } | null
  assigned_sections: AssignedSection[]
}

/** Flattened entry for the swipe carousel — one card per exercise. */
interface FlatExercise {
  ex: AssignedExercise
  sectionType: SectionType
  positionInSection: number // 1-indexed
  sectionCount: number
  positionInSession: number // 1-indexed
  sessionCount: number
}

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default async function SessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id: sessionId } = await params
  const { error: errMsg } = await searchParams

  await requireUser()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('assigned_sessions')
    .select(
      `
      id, session_index, name,
      assignment_weeks!inner (
        week_index, name,
        client_assignments!inner ( id, name, weeks )
      ),
      assigned_sections (
        id, order_index, section_type,
        assigned_exercises (
          id, order_index, prescribed_sets, prescribed_reps, notes,
          exercises ( id, name, video_url, default_notes ),
          exercise_logs (
            id, set_number, weight_kg, reps_done, rpe, notes, logged_at
          )
        )
      )
    `,
    )
    .eq('id', sessionId)
    .single()

  if (error || !data) notFound()

  const session = data as unknown as SessionData
  session.assigned_sections.sort((a, b) => a.order_index - b.order_index)
  for (const sec of session.assigned_sections) {
    sec.assigned_exercises.sort((a, b) => a.order_index - b.order_index)
    for (const ex of sec.assigned_exercises) {
      ex.exercise_logs.sort((a, b) => a.set_number - b.set_number)
    }
  }

  // Flatten into carousel order with positional metadata
  const flat: FlatExercise[] = []
  for (const sec of session.assigned_sections) {
    for (let i = 0; i < sec.assigned_exercises.length; i++) {
      flat.push({
        ex: sec.assigned_exercises[i],
        sectionType: sec.section_type,
        positionInSection: i + 1,
        sectionCount: sec.assigned_exercises.length,
        positionInSession: flat.length + 1,
        sessionCount: 0, // patched below
      })
    }
  }
  flat.forEach((f) => (f.sessionCount = flat.length))

  const week = session.assignment_weeks!
  const assignment = week.client_assignments!

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-12 pt-6">
      <header className="mb-6 flex items-start justify-between gap-3">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="-ml-2 inline-flex h-12 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden className="text-xl">
            ←
          </span>
          Back
        </Link>
        <WioLogo variant="mark" size={64} />
      </header>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-brand">
          {assignment.name} · Week {week.week_index}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{session.name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Session {session.session_index} · {flat.length}{' '}
          exercise{flat.length === 1 ? '' : 's'}
        </p>
      </div>

      {errMsg && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {decodeURIComponent(errMsg)}
        </p>
      )}

      {flat.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No content authored for this session yet.
        </p>
      ) : (
        <>
          <p className="mb-3 text-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Swipe to navigate
          </p>
          <div
            className="-mx-5 flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
            style={{ scrollPaddingInline: '1.25rem' }}
          >
            {flat.map((entry, i) => {
              const prev = flat[i - 1]
              const next = flat[i + 1]
              return (
                <section
                  key={entry.ex.id}
                  id={`ex-${entry.ex.id}`}
                  className="min-w-full shrink-0 snap-center px-5"
                >
                  <ExerciseCard
                    entry={entry}
                    sessionId={sessionId}
                    prevAnchor={prev ? `#ex-${prev.ex.id}` : null}
                    nextAnchor={next ? `#ex-${next.ex.id}` : null}
                  />
                </section>
              )
            })}
          </div>
        </>
      )}
    </main>
  )
}

function fmtWeight(kg: number | null) {
  if (kg === null) return '—'
  return Number.parseFloat(kg.toString()).toString() + ' kg'
}

function ExerciseCard({
  entry,
  sessionId,
  prevAnchor,
  nextAnchor,
}: {
  entry: FlatExercise
  sessionId: string
  prevAnchor: string | null
  nextAnchor: string | null
}) {
  const { ex, sectionType, positionInSection, sectionCount } = entry
  const name = ex.exercises?.name ?? '(deleted exercise)'
  const videoUrl = ex.exercises?.video_url
  const sharedNotes = ex.notes || ex.exercises?.default_notes
  const prescribed =
    [ex.prescribed_sets, ex.prescribed_reps].filter(Boolean).join(' × ') || null

  const loggedCount = ex.exercise_logs.length
  const maxSets = parseMaxSets(ex.prescribed_sets)
  const allLogged = maxSets !== null && loggedCount >= maxSets

  const logSetBound = logSet.bind(null, ex.id, sessionId)

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {sectionLabel(sectionType)}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {positionInSection} / {sectionCount}
        </span>
      </header>

      <div className="mb-3">
        <h3 className="text-lg font-medium">{name}</h3>
        {prescribed && (
          <p className="mt-0.5 text-sm text-muted-foreground">
            Prescribed: <span className="text-foreground">{prescribed}</span>
          </p>
        )}
        {sharedNotes && (
          <p className="mt-1 text-xs text-muted-foreground">{sharedNotes}</p>
        )}
        {videoUrl && (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-brand underline-offset-4 hover:underline"
          >
            Watch demo
          </a>
        )}
      </div>

      {ex.exercise_logs.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {ex.exercise_logs.map((log) => (
            <li
              key={log.id}
              className="flex items-center gap-3 rounded-lg bg-background px-3 py-2 text-sm tabular-nums"
            >
              <span className="w-10 shrink-0 text-xs uppercase tracking-wide text-muted-foreground">
                Set {log.set_number}
              </span>
              <span className="flex-1">
                <span className="font-medium">{fmtWeight(log.weight_kg)}</span>
                {log.reps_done !== null && (
                  <span className="text-muted-foreground"> × </span>
                )}
                {log.reps_done !== null && (
                  <span className="font-medium">{log.reps_done}</span>
                )}
                {log.rpe !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    RPE {log.rpe}
                  </span>
                )}
              </span>
              <form
                action={async () => {
                  'use server'
                  await deleteLog(log.id, sessionId)
                }}
              >
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Delete set ${log.set_number}`}
                >
                  ×
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {allLogged ? (
        <div className="rounded-lg border border-brand/40 bg-brand/10 p-4 text-center">
          <p className="text-sm font-medium text-brand">
            ✓ All {maxSets} set{maxSets === 1 ? '' : 's'} logged
          </p>
          {nextAnchor && (
            <p className="mt-1 text-xs text-muted-foreground">
              Swipe to the next exercise.
            </p>
          )}
        </div>
      ) : (
        <form action={logSetBound} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Weight (kg)</span>
              <input
                name="weight_kg"
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                placeholder="0"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Reps</span>
              <input
                name="reps_done"
                type="number"
                inputMode="numeric"
                step="1"
                min={0}
                placeholder="0"
                className={inputClass}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              RPE <span className="opacity-60">(optional, 0–10)</span>
            </span>
            <input
              name="rpe"
              type="number"
              inputMode="decimal"
              step="0.5"
              min={0}
              max={10}
              placeholder="—"
              className={inputClass}
            />
          </label>
          <Button type="submit" size="lg" className="w-full">
            Log set {loggedCount + 1}
            {maxSets !== null ? ` of ${maxSets}` : ''}
          </Button>
        </form>
      )}

      {/* Prev / next nav anchors. Browser jumps to the snap point. */}
      <nav className="mt-4 flex items-center justify-between text-sm">
        {prevAnchor ? (
          <a
            href={prevAnchor}
            className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <span aria-hidden className="text-lg">
              ←
            </span>
            Prev
          </a>
        ) : (
          <span />
        )}
        {nextAnchor ? (
          <a
            href={nextAnchor}
            className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-brand transition-opacity hover:opacity-80"
          >
            Next
            <span aria-hidden className="text-lg">
              →
            </span>
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            Last exercise — swipe back when done
          </span>
        )}
      </nav>
    </article>
  )
}
