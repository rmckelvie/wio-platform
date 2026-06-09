import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'
import { sectionLabel, type SectionType } from '@/lib/sections'
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

  // Auth check (admins can also view but the UI is built for clients)
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

  const week = session.assignment_weeks!
  const assignment = week.client_assignments!

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-24 pt-6">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className="-ml-2 inline-flex h-10 items-center gap-1 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span aria-hidden className="text-lg">
            ←
          </span>
          Back
        </Link>
        <WioLogo variant="mark" size={36} />
      </header>

      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-brand">
          {assignment.name} · Week {week.week_index}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{session.name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Session {session.session_index}
        </p>
      </div>

      {errMsg && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {decodeURIComponent(errMsg)}
        </p>
      )}

      {session.assigned_sections.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          No content authored for this session yet.
        </p>
      ) : (
        <div className="space-y-8">
          {session.assigned_sections.map((sec) => (
            <SectionView
              key={sec.id}
              section={sec}
              sessionId={sessionId}
            />
          ))}
        </div>
      )}
    </main>
  )
}

function SectionView({
  section,
  sessionId,
}: {
  section: AssignedSection
  sessionId: string
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-brand">
        {sectionLabel(section.section_type)}
      </h2>

      {section.assigned_exercises.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
          No exercises in this section.
        </p>
      ) : (
        <ul className="space-y-4">
          {section.assigned_exercises.map((ex) => (
            <li key={ex.id}>
              <ExerciseCard ex={ex} sessionId={sessionId} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function fmtWeight(kg: number | null) {
  if (kg === null) return '—'
  // Trim trailing zeros for tidy display: 60.00 → 60, 62.50 → 62.5
  return Number.parseFloat(kg.toString()).toString() + ' kg'
}

function ExerciseCard({
  ex,
  sessionId,
}: {
  ex: AssignedExercise
  sessionId: string
}) {
  const name = ex.exercises?.name ?? '(deleted exercise)'
  const videoUrl = ex.exercises?.video_url
  const sharedNotes = ex.notes || ex.exercises?.default_notes
  const prescribed =
    [ex.prescribed_sets, ex.prescribed_reps].filter(Boolean).join(' × ') || null

  const logSetBound = logSet.bind(null, ex.id, sessionId)

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3">
        <h3 className="text-base font-medium">{name}</h3>
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
          Log set {ex.exercise_logs.length + 1}
        </Button>
      </form>
    </article>
  )
}
