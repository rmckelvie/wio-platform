import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDate } from '@/lib/dates'
import { SECTION_TYPES, sectionLabel, type SectionType } from '@/lib/sections'
import {
  createSession,
  createSection,
  createAssignedExercise,
  deleteSession,
  deleteSection,
  deleteAssignedExercise,
  moveSession,
  moveSection,
  moveAssignedExercise,
  copyWeekContents,
  propagateToLaterWeeks,
} from './actions'
import { StatusBadge } from '@/components/status-badge'

interface ExerciseLibraryRow {
  id: string
  name: string
  section_types: SectionType[] | null
}

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
        id, session_index, name,
        assigned_sections (
          id, order_index, section_type,
          assigned_exercises (
            id, order_index, prescribed_sets, prescribed_reps, notes,
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
    .select('id, name, section_types')
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
      <div className="text-sm">
        <Link
          href={`/admin/assignments/${week.assignment_id}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← {assignment.name}
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link
          href={`/admin/clients/${assignment.client_id}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
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

function SessionCard({
  session,
  library,
  isFirst,
  isLast,
}: {
  session: AssignedSession
  library: ExerciseLibraryRow[]
  isFirst: boolean
  isLast: boolean
}) {
  const usedSectionTypes = new Set(
    session.assigned_sections.map((s) => s.section_type),
  )
  const availableSectionTypes = SECTION_TYPES.filter(
    (t) => !usedSectionTypes.has(t),
  )

  return (
    <article className="rounded border border-border bg-card p-4">
      <header className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <form
              action={async () => {
                'use server'
                await moveSession(session.id, 'up')
              }}
            >
              <Button
                type="submit"
                variant="ghost"
                size="icon-xs"
                disabled={isFirst}
                aria-label="Move session up"
              >
                ↑
              </Button>
            </form>
            <form
              action={async () => {
                'use server'
                await moveSession(session.id, 'down')
              }}
            >
              <Button
                type="submit"
                variant="ghost"
                size="icon-xs"
                disabled={isLast}
                aria-label="Move session down"
              >
                ↓
              </Button>
            </form>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Session {session.session_index}
            </span>
            <h2 className="text-lg font-medium">{session.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/admin/sessions/${session.id}/edit`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Rename
          </Link>
          <form
            action={async () => {
              'use server'
              await deleteSession(session.id)
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          </form>
        </div>
      </header>

      <div className="space-y-4">
        {session.assigned_sections.map((section, i) => (
          <SectionBlock
            key={section.id}
            section={section}
            library={library}
            isFirst={i === 0}
            isLast={i === session.assigned_sections.length - 1}
          />
        ))}

        {availableSectionTypes.length > 0 ? (
          <form
            action={createSection.bind(null, session.id)}
            className="flex items-end gap-2 border-t border-border pt-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Add section
              </span>
              <select
                name="section_type"
                required
                defaultValue={availableSectionTypes[0]}
                className={inputClass}
              >
                {availableSectionTypes.map((t) => (
                  <option key={t} value={t}>
                    {sectionLabel(t)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" size="sm" variant="outline">
              Add
            </Button>
          </form>
        ) : (
          <p className="border-t border-border pt-4 text-xs text-muted-foreground">
            All section types used in this session.
          </p>
        )}
      </div>
    </article>
  )
}

function SectionBlock({
  section,
  library,
  isFirst,
  isLast,
}: {
  section: AssignedSection
  library: ExerciseLibraryRow[]
  isFirst: boolean
  isLast: boolean
}) {
  // Show exercises whose tags include this section type, plus untagged
  // (empty section_types acts as wildcard so legacy rows stay reachable).
  const filteredLibrary = library.filter((ex) => {
    const tags = ex.section_types ?? []
    return tags.length === 0 || tags.includes(section.section_type)
  })

  return (
    <section className="rounded border border-border/60 bg-background p-3">
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <form
            action={async () => {
              'use server'
              await moveSection(section.id, 'up')
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="icon-xs"
              disabled={isFirst}
              aria-label="Move section up"
            >
              ↑
            </Button>
          </form>
          <form
            action={async () => {
              'use server'
              await moveSection(section.id, 'down')
            }}
          >
            <Button
              type="submit"
              variant="ghost"
              size="icon-xs"
              disabled={isLast}
              aria-label="Move section down"
            >
              ↓
            </Button>
          </form>
          <h3 className="text-sm font-medium uppercase tracking-wide text-brand">
            {sectionLabel(section.section_type)}
          </h3>
        </div>
        <form
          action={async () => {
            'use server'
            await deleteSection(section.id)
          }}
        >
          <Button
            type="submit"
            variant="ghost"
            size="xs"
            className="text-destructive hover:bg-destructive/10"
          >
            Delete section
          </Button>
        </form>
      </header>

      {section.assigned_exercises.length === 0 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          No exercises yet.
        </p>
      ) : (
        <ul className="mb-3 divide-y divide-border/60">
          {section.assigned_exercises.map((ae, i) => {
            const isFirstEx = i === 0
            const isLastEx = i === section.assigned_exercises.length - 1
            const logs = ae.exercise_logs ?? []
            return (
              <li key={ae.id} className="py-2 text-sm">
                <div className="flex items-center gap-3">
                  <div className="flex shrink-0 flex-col">
                    <form
                      action={async () => {
                        'use server'
                        await moveAssignedExercise(ae.id, 'up')
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isFirstEx}
                        aria-label="Move exercise up"
                      >
                        ↑
                      </Button>
                    </form>
                    <form
                      action={async () => {
                        'use server'
                        await moveAssignedExercise(ae.id, 'down')
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon-xs"
                        disabled={isLastEx}
                        aria-label="Move exercise down"
                      >
                        ↓
                      </Button>
                    </form>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">
                      {ae.exercises?.name ?? '(deleted exercise)'}
                    </div>
                    {ae.notes && (
                      <div className="text-xs text-muted-foreground">
                        {ae.notes}
                      </div>
                    )}
                    {ae.exercises?.video_url && (
                      <a
                        href={ae.exercises.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand hover:underline"
                      >
                        Demo
                      </a>
                    )}
                  </div>
                  <div className="w-16 text-right tabular-nums text-xs">
                    {ae.prescribed_sets ?? '—'}
                  </div>
                  <div className="w-20 text-right tabular-nums text-xs">
                    {ae.prescribed_reps ?? '—'}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/admin/assigned-exercises/${ae.id}/edit`}
                      className={buttonVariants({ variant: 'ghost', size: 'xs' })}
                    >
                      Edit
                    </Link>
                    <form
                      action={async () => {
                        'use server'
                        await deleteAssignedExercise(ae.id)
                      }}
                    >
                      <Button
                        type="submit"
                        variant="ghost"
                        size="xs"
                        className="text-destructive hover:bg-destructive/10"
                      >
                        ×
                      </Button>
                    </form>
                  </div>
                </div>

                {/* Client-logged sets (read-only) */}
                {logs.length > 0 && (
                  <div className="ml-8 mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="uppercase tracking-wide text-muted-foreground">
                      Client logged:
                    </span>
                    {logs.map((log) => (
                      <span
                        key={log.id}
                        className="rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 tabular-nums text-brand"
                      >
                        <span className="opacity-70">#{log.set_number} </span>
                        {log.weight_kg !== null
                          ? `${Number.parseFloat(log.weight_kg.toString())}kg`
                          : '—'}
                        {log.reps_done !== null && (
                          <span> × {log.reps_done}</span>
                        )}
                        {log.rpe !== null && (
                          <span className="opacity-70"> · RPE {log.rpe}</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* Inline add-exercise form */}
      {filteredLibrary.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No exercises in your library are tagged {sectionLabel(section.section_type)}.{' '}
          <Link
            href={`/admin/exercises?tag=${section.section_type}`}
            className="text-brand underline-offset-4 hover:underline"
          >
            Tag some
          </Link>{' '}
          first.
        </p>
      ) : (
        <form
          action={createAssignedExercise.bind(null, section.id)}
          className="flex flex-wrap items-end gap-2"
        >
          <label className="flex min-w-[160px] flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Exercise</span>
            <select
              name="exercise_id"
              required
              className={inputClass}
              defaultValue=""
            >
              <option value="" disabled>
                Pick…
              </option>
              {filteredLibrary.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex w-20 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Sets</span>
            <input
              name="prescribed_sets"
              type="text"
              placeholder="3"
              className={inputClass}
            />
          </label>
          <label className="flex w-24 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Reps</span>
            <input
              name="prescribed_reps"
              type="text"
              placeholder="5 or 6/6"
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[140px] flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Notes</span>
            <input
              name="notes"
              type="text"
              placeholder="optional"
              className={inputClass}
            />
          </label>
          <Button type="submit" size="sm" variant="outline">
            Add
          </Button>
        </form>
      )}
    </section>
  )
}
