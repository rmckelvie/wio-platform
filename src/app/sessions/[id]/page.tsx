import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'
import { sectionLabel, type SectionType } from '@/lib/sections'
import { parseMaxSets } from '@/lib/prescription'
import {
  logSet,
  deleteLog,
  toggleSessionComplete,
  saveSessionNotes,
} from './actions'
import { RestTimer } from '@/components/rest-timer'
import { EmomTimer } from '@/components/emom-timer'
import { WeightInput } from '@/components/weight-input'

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
  rest_seconds: number | null
  work_interval_seconds: number | null
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
  completed_at: string | null
  client_notes: string | null
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

interface PriorLog {
  id: string
  set_number: number
  weight_kg: number | null
  reps_done: number | null
  rpe: number | null
  logged_at: string
  assigned_exercise_id: string
  assigned_exercises: { exercise_id: string } | null
}

interface LastSession {
  logs: PriorLog[]
  date: string
}

interface FlatExercise {
  ex: AssignedExercise
  sectionType: SectionType
  positionInSection: number
  sectionCount: number
  positionInSession: number
  sessionCount: number
  lastSession: LastSession | null
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
      id, session_index, name, completed_at, client_notes,
      assignment_weeks!inner (
        week_index, name,
        client_assignments!inner ( id, name, weeks )
      ),
      assigned_sections (
        id, order_index, section_type,
        assigned_exercises (
          id, order_index, prescribed_sets, prescribed_reps, notes,
          rest_seconds, work_interval_seconds,
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

  // Gather library exercise ids + current assigned_exercise ids
  const exerciseIds = new Set<string>()
  const currentAeIds = new Set<string>()
  for (const sec of session.assigned_sections) {
    for (const ae of sec.assigned_exercises) {
      if (ae.exercises?.id) exerciseIds.add(ae.exercises.id)
      currentAeIds.add(ae.id)
    }
  }

  // Fetch all logs for these exercise ids (RLS filters to current user).
  // Used for BOTH "last time" history AND personal-record detection.
  let priorByExerciseId = new Map<string, LastSession>()
  const prSet = new Set<string>() // log ids that are new PRs at the time of logging
  if (exerciseIds.size > 0) {
    const { data: priorRows } = await supabase
      .from('exercise_logs')
      .select(
        `
        id, set_number, weight_kg, reps_done, rpe, logged_at,
        assigned_exercise_id,
        assigned_exercises!inner ( exercise_id )
      `,
      )
      .in('assigned_exercises.exercise_id', Array.from(exerciseIds))
      .order('logged_at', { ascending: false })
      .limit(500)

    const prior = (priorRows ?? []) as unknown as PriorLog[]

    // For each library exercise_id, find the most recent OTHER assigned_exercise
    // (i.e. not on this page) and gather all its logs for the "last time" panel.
    const aeChoice = new Map<string, string>() // exercise_id -> assigned_exercise_id
    for (const log of prior) {
      if (currentAeIds.has(log.assigned_exercise_id)) continue
      const exId = log.assigned_exercises?.exercise_id
      if (!exId) continue
      if (!aeChoice.has(exId)) {
        aeChoice.set(exId, log.assigned_exercise_id)
      }
    }
    for (const log of prior) {
      const exId = log.assigned_exercises?.exercise_id
      if (!exId) continue
      const chosen = aeChoice.get(exId)
      if (!chosen || chosen !== log.assigned_exercise_id) continue
      const existing = priorByExerciseId.get(exId)
      if (existing) {
        existing.logs.push(log)
      } else {
        priorByExerciseId.set(exId, { logs: [log], date: log.logged_at })
      }
    }
    for (const v of priorByExerciseId.values()) {
      v.logs.sort((a, b) => a.set_number - b.set_number)
    }

    // PR detection: walk logs in chronological order per exercise_id and
    // mark any log whose weight_kg strictly exceeds every prior log's
    // weight_kg as a new PR.
    const byExercise = new Map<string, PriorLog[]>()
    for (const log of prior) {
      const exId = log.assigned_exercises?.exercise_id
      if (!exId) continue
      if (log.weight_kg === null) continue
      const arr = byExercise.get(exId) ?? []
      arr.push(log)
      byExercise.set(exId, arr)
    }
    for (const arr of byExercise.values()) {
      arr.sort((a, b) => a.logged_at.localeCompare(b.logged_at))
      let runMax = -Infinity
      for (const log of arr) {
        if ((log.weight_kg ?? -Infinity) > runMax) {
          runMax = log.weight_kg as number
          prSet.add(log.id)
        }
      }
    }
  }

  const flat: FlatExercise[] = []
  for (const sec of session.assigned_sections) {
    for (let i = 0; i < sec.assigned_exercises.length; i++) {
      const ex = sec.assigned_exercises[i]
      const exId = ex.exercises?.id ?? null
      const last = exId ? priorByExerciseId.get(exId) ?? null : null
      flat.push({
        ex,
        sectionType: sec.section_type,
        positionInSection: i + 1,
        sectionCount: sec.assigned_exercises.length,
        positionInSession: flat.length + 1,
        sessionCount: 0,
        lastSession: last,
      })
    }
  }
  flat.forEach((f) => (f.sessionCount = flat.length))

  const week = session.assignment_weeks!
  const assignment = week.client_assignments!
  const isComplete = !!session.completed_at

  // Counts for summary card
  const totalSets = session.assigned_sections.reduce(
    (acc, sec) =>
      acc +
      sec.assigned_exercises.reduce(
        (a, ex) => a + ex.exercise_logs.length,
        0,
      ),
    0,
  )

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
        <WioLogo variant="mark" size={192} />
      </header>

      <div className="mb-6">
        <p className="text-xs uppercase tracking-wide text-brand">
          {assignment.name} · Week {week.week_index}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{session.name}</h1>
          {isComplete && (
            <span
              className="rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand"
              aria-label="Session completed"
            >
              ✓ Done
            </span>
          )}
        </div>
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
          <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth">
            {flat.map((entry, i) => {
              const prev = flat[i - 1]
              const next = flat[i + 1]
              return (
                <section
                  key={entry.ex.id}
                  id={`ex-${entry.ex.id}`}
                  className="w-full shrink-0 snap-center"
                >
                  <ExerciseCard
                    entry={entry}
                    sessionId={sessionId}
                    prSet={prSet}
                    prevAnchor={prev ? `#ex-${prev.ex.id}` : null}
                    nextAnchor={next ? `#ex-${next.ex.id}` : '#summary'}
                  />
                </section>
              )
            })}
            <section
              id="summary"
              className="w-full shrink-0 snap-center"
            >
              <SummaryCard
                sessionId={session.id}
                sessionName={session.name}
                isComplete={isComplete}
                completedAt={session.completed_at}
                exerciseCount={flat.length}
                totalSets={totalSets}
                clientNotes={session.client_notes}
                prevAnchor={
                  flat.length > 0 ? `#ex-${flat[flat.length - 1].ex.id}` : null
                }
              />
            </section>
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

/**
 * Smart-default weight: most recent current-session log first, then the
 * heaviest set of the previous session. Returns null when there's no
 * prior data to lean on.
 */
function pickDefaultWeight(
  currentLogs: ExerciseLog[],
  last: LastSession | null,
): number | null {
  for (let i = currentLogs.length - 1; i >= 0; i--) {
    const w = currentLogs[i].weight_kg
    if (w !== null) return w
  }
  if (!last) return null
  let max: number | null = null
  for (const log of last.logs) {
    if (log.weight_kg === null) continue
    if (max === null || log.weight_kg > max) max = log.weight_kg
  }
  return max
}

/**
 * Smart-default reps:
 *  - Most recent current-session reps_done if present
 *  - Else, the prescribed reps if it parses to a single integer (e.g. "5")
 *    or to a range — we pick the lower bound for ranges like "5-8"
 *  - Else null (input stays blank)
 */
function pickDefaultReps(
  currentLogs: ExerciseLog[],
  prescribed: string | null,
): number | null {
  for (let i = currentLogs.length - 1; i >= 0; i--) {
    const r = currentLogs[i].reps_done
    if (r !== null) return r
  }
  if (!prescribed) return null
  const trimmed = prescribed.trim()
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10)
  const range = /^(\d+)\s*[-–]/.exec(trimmed)
  if (range) return Number.parseInt(range[1], 10)
  return null
}

function ExerciseCard({
  entry,
  sessionId,
  prSet,
  prevAnchor,
  nextAnchor,
}: {
  entry: FlatExercise
  sessionId: string
  prSet: Set<string>
  prevAnchor: string | null
  nextAnchor: string | null
}) {
  const { ex, sectionType, positionInSection, sectionCount, lastSession } = entry
  const name = ex.exercises?.name ?? '(deleted exercise)'
  const videoUrl = ex.exercises?.video_url
  const sharedNotes = ex.notes || ex.exercises?.default_notes
  const prescribed =
    [ex.prescribed_sets, ex.prescribed_reps].filter(Boolean).join(' × ') || null

  const loggedCount = ex.exercise_logs.length
  const maxSets = parseMaxSets(ex.prescribed_sets)
  const allLogged = maxSets !== null && loggedCount >= maxSets

  const logSetBound = logSet.bind(null, ex.id, sessionId)

  const lastLog = ex.exercise_logs[ex.exercise_logs.length - 1]
  const hasEmom = !!ex.work_interval_seconds && ex.work_interval_seconds > 0
  const restSecs = !hasEmom && ex.rest_seconds ? ex.rest_seconds : 0
  const emomSets = hasEmom
    ? maxSets ?? Math.max(1, loggedCount + 1)
    : 0

  // Smart defaults: pre-fill weight with the most recent log of this
  // exercise, current session first then previous session. Reps use the
  // prescribed value when it parses to an integer, otherwise blank.
  const defaultWeight = pickDefaultWeight(ex.exercise_logs, lastSession)
  const defaultReps = pickDefaultReps(ex.exercise_logs, ex.prescribed_reps)

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

      {/* Timers */}
      {hasEmom && (
        <EmomTimer
          intervalSeconds={ex.work_interval_seconds!}
          totalSets={emomSets}
        />
      )}
      {!hasEmom && restSecs > 0 && lastLog && (
        <RestTimer
          key={lastLog.id}
          totalSeconds={restSecs}
          startedAtIso={lastLog.logged_at}
        />
      )}

      {lastSession && (
        <div className="mb-3 rounded-lg border border-border bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Last time · {fmtDate(lastSession.date)}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {lastSession.logs.map((log) => (
              <li
                key={log.id}
                className="rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums text-foreground"
              >
                <span className="opacity-60">#{log.set_number} </span>
                {log.weight_kg !== null
                  ? `${Number.parseFloat(log.weight_kg.toString())}kg`
                  : '—'}
                {log.reps_done !== null && (
                  <span> × {log.reps_done}</span>
                )}
                {log.rpe !== null && (
                  <span className="opacity-60"> · {log.rpe}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ex.exercise_logs.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {ex.exercise_logs.map((log) => {
            const isPr = prSet.has(log.id)
            return (
              <li
                key={log.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm tabular-nums ${
                  isPr
                    ? 'border border-brand/40 bg-brand/10'
                    : 'bg-background'
                }`}
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
                  {isPr && (
                    <span
                      className="ml-2 inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand"
                      aria-label="Personal record"
                    >
                      🏆 PR
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
            )
          })}
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
        <form action={logSetBound} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Weight (kg)</span>
              <WeightInput defaultValue={defaultWeight} />
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
                defaultValue={defaultReps ?? ''}
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
          <span />
        )}
      </nav>
    </article>
  )
}

function SummaryCard({
  sessionId,
  sessionName,
  isComplete,
  completedAt,
  exerciseCount,
  totalSets,
  clientNotes,
  prevAnchor,
}: {
  sessionId: string
  sessionName: string
  isComplete: boolean
  completedAt: string | null
  exerciseCount: number
  totalSets: number
  clientNotes: string | null
  prevAnchor: string | null
}) {
  const saveNotesBound = saveSessionNotes.bind(null, sessionId)
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Wrap up
        </span>
      </header>

      <h3 className="text-lg font-medium">{sessionName}</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {exerciseCount} exercise{exerciseCount === 1 ? '' : 's'} · {totalSets}{' '}
        set{totalSets === 1 ? '' : 's'} logged
      </p>

      {isComplete && completedAt && (
        <p className="mt-2 text-xs text-brand">
          Marked complete on{' '}
          {new Date(completedAt).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}

      <form action={saveNotesBound} className="mt-5 space-y-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            How did it go?
          </span>
          <textarea
            name="client_notes"
            rows={3}
            defaultValue={clientNotes ?? ''}
            placeholder="Anything you want to remember — felt strong, low energy, dodgy shoulder..."
            className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </label>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="w-full"
        >
          Save reflection
        </Button>
      </form>

      <div className="mt-5">
        <form
          action={async () => {
            'use server'
            await toggleSessionComplete(sessionId, isComplete)
          }}
        >
          {isComplete ? (
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full"
            >
              Mark as not complete
            </Button>
          ) : (
            <Button type="submit" size="lg" className="w-full">
              ✓ Mark session complete
            </Button>
          )}
        </form>
      </div>

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
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-1 rounded-lg px-2 text-brand transition-opacity hover:opacity-80"
        >
          Done
          <span aria-hidden className="text-lg">
            →
          </span>
        </Link>
      </nav>
    </article>
  )
}
