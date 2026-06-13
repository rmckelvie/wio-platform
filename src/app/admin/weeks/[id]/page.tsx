import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { type SectionType } from '@/lib/sections'
import {
  createSession,
  copyWeekContents,
  propagateToLaterWeeks,
} from './actions'
import { StatusBadge } from '@/components/status-badge'
import { SessionCard, type ExerciseLibraryRow } from './session-card'

interface ExerciseLog {
  id: string
  set_number: number
  weight_kg: number | null
  reps_done: number | null
  rpe: number | null
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
  exercises: { id: string; name: string; video_url: string | null } | null
  exercise_logs: ExerciseLog[]
}

interface AssignedSection {
  id: string
  order_index: number
  section_type: SectionType
  assigned_exercises: AssignedExercise[]
}

interface AssignedSession {
  id: string
  session_index: number
  name: string
  client_notes: string | null
  assigned_sections: AssignedSection[]
}

interface WeekRow {
  id: string
  week_index: number
  name: string | null
  release_date: string
  assignment_id: string
  client_assignments: {
    id: string
    name: string
    weeks: number
    client_id: string
    profiles: { email: string; display_name: string | null } | null
  } | null
  assigned_sessions: AssignedSession[]
}

const inputClass =
  'rounded border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default async function WeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; msg?: string }>
}) {
  const { id: weekId } = await params
  const { error: errMsg, msg: infoMsg } = await searchParams

  const supabase = await createClient()

  const { data: weekData, error } = await supabase
    .from('assignment_weeks')
    .select(
      `
      id, week_index, name, release_date, assignment_id,
      client_assignments!inner (
        id, name, weeks, client_id,
        profiles ( email, display_name )
      ),
      assigned_sessions (
        id, session_index, name, client_notes,
        assigned_sections (
          id, order_index, section_type,
          assigned_exercises (
            id, order_index, prescribed_sets, prescribed_reps, notes,
            rest_seconds, work_interval_seconds,
            exercises ( id, name, video_url ),
            exercise_logs (
              id, set_number, weight_kg, reps_done, rpe, logged_at
            )
          )
        )
      )
    `,
    )
    .eq('id', weekId)
    .single()

  if (error || !weekData) notFound()

  const week = weekData as unknown as WeekRow

  // Sort nested in JS (Supabase nested .order is awkward across 3 levels)
  week.assigned_sessions.sort((a, b) => a.session_index - b.session_index)
  week.assigned_sessions.forEach((s) => {
    s.assigned_sections.sort((a, b) => a.order_index - b.order_index)
    s.assigned_sections.forEach((sec) => {
      sec.assigned_exercises.sort((a, b) => a.order_index - b.order_index)
      sec.assigned_exercises.forEach((ae) => {
        ae.exercise_logs?.sort?.((a, b) => a.set_number - b.set_number)
      })
    })
  })

  const { data: libraryRows } = await supabase
    .from('exercises')
    .select('id, name, section_types, subcategory')
    .eq('archived', false)
    .order('name', { ascending: true })

  const library = (libraryRows ?? []) as ExerciseLibraryRow[]

  // All other weeks the admin can copy from (any assignment, any client)
  const { data: copySourceRows } = await supabase
    .from('assignment_weeks')
    .select(
      `
      id, week_index, name,
      client_assignments!inner (
        name, start_date, client_id,
        profiles ( email, display_name )
      )
    `,
    )
    .neq('id', weekId)
    .limit(200)

  type CopySource = {
    id: string
    week_index: number
    name: string | null
    client_assignments: {
      name: string
      start_date: string
      client_id: string
      profiles: { email: string; display_name: string | null } | null
    }
  }
  const copySources = ((copySourceRows ?? []) as unknown as CopySource[])
    .map((r) => ({
      id: r.id,
      label: `${r.client_assignments.profiles?.display_name || r.client_assignments.profiles?.email || 'client'} — ${r.client_assignments.name} — Week ${r.week_index}${r.name ? ` (${r.name})` : ''}`,
      start_date: r.client_assignments.start_date,
    }))
    .sort((a, b) => {
      // Most recent assignment first; otherwise alphabetical label
      const dt = b.start_date.localeCompare(a.start_date)
      if (dt !== 0) return dt
      return a.label.localeCompare(b.label)
    })

  const assignment = week.client_assignments!
  const clientName =
    assignment.profiles?.display_name || assignment.profiles?.email || 'client'
  const today = new Date().toISOString().slice(0, 10)
  const released = week.release_date <= today

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/assignments/${week.assignment_id}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ← {assignment.name}
        </Link>
        <Link
          href={`/admin/clients/${assignment.client_id}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          {clientName}
        </Link>
      </div>

      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            Week {week.week_index}
            {week.name ? ` — ${week.name}` : ''}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {released
              ? `Released ${formatDate(week.release_date)}`
              : `Unlocks ${formatDate(week.release_date)}`}
          </p>
        </div>
      </header>

      {errMsg && (
        <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {decodeURIComponent(errMsg)}
        </p>
      )}

      {infoMsg && (
        <p className="rounded border border-brand/40 bg-brand/10 p-3 text-sm text-brand">
          {decodeURIComponent(infoMsg)}
        </p>
      )}

      {library.length === 0 && (
        <p className="rounded border border-border bg-card p-4 text-sm">
          Your exercise library is empty. Add some on{' '}
          <Link href="/admin/exercises" className="text-brand hover:underline">
            /admin/exercises
          </Link>{' '}
          before you can prescribe.
        </p>
      )}

      {/* Bulk-copy actions */}
      {(copySources.length > 0 || week.assigned_sessions.length > 0) && (
        <div className="space-y-3 rounded border border-border bg-card/50 p-3">
          {copySources.length > 0 && (
            <form
              action={copyWeekContents.bind(null, week.id)}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex min-w-[260px] flex-1 flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Copy from another week
                </span>
                <select
                  name="source_week_id"
                  required
                  defaultValue=""
                  className={inputClass}
                >
                  <option value="" disabled>
                    Pick a source week…
                  </option>
                  {copySources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm" variant="outline">
                Append copy
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                Appends a snapshot of the source week&apos;s content below
                whatever&apos;s already here. Edits afterwards don&apos;t
                affect the source.
              </p>
            </form>
          )}

          {week.assigned_sessions.length > 0 &&
            assignment.weeks > week.week_index && (
              <form
                action={async () => {
                  'use server'
                  await propagateToLaterWeeks(week.id)
                }}
                className="flex flex-wrap items-center gap-2 border-t border-border pt-3"
              >
                <Button type="submit" size="sm" variant="outline">
                  Apply this week to all later weeks
                </Button>
                <p className="text-xs text-muted-foreground">
                  Copies into every later week of this block that is currently
                  empty. Non-empty weeks are skipped. Useful for "author Week 1,
                  then progress sets/reps in each subsequent week."
                </p>
              </form>
            )}
        </div>
      )}

      {/* Sessions */}
      <div className="space-y-6">
        {week.assigned_sessions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No sessions yet. Add one below.
          </p>
        )}

        {week.assigned_sessions.map((session, i) => (
          <SessionCard
            key={session.id}
            session={session}
            library={library}
            assignmentId={week.assignment_id}
            isFirst={i === 0}
            isLast={i === week.assigned_sessions.length - 1}
          />
        ))}

        {/* Add session inline */}
        <form
          action={createSession.bind(null, week.id)}
          className="flex flex-wrap items-end gap-2 rounded border border-dashed border-border bg-card/50 p-3"
        >
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              New session
            </span>
            <input
              name="name"
              type="text"
              required
              placeholder="e.g. Upper A"
              className={inputClass}
            />
          </label>
          <Button type="submit" size="sm">
            Add session
          </Button>
        </form>
      </div>
    </div>
  )
}
