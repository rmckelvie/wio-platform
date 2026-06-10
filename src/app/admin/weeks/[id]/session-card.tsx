'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { SECTION_TYPES, sectionLabel, type SectionType } from '@/lib/sections'
import {
  createSection,
  createAssignedExercise,
  deleteSession,
  deleteSection,
  deleteAssignedExercise,
  moveSession,
  moveSection,
  moveAssignedExercise,
} from './actions'

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

export interface ExerciseLibraryRow {
  id: string
  name: string
  section_types: SectionType[] | null
  subcategory: string | null
}

const STRENGTH_SUBCATEGORIES = [
  'chest',
  'shoulders',
  'arms',
  'legs',
  'back',
] as const

function subcategoryLabel(s: string | null): string {
  if (!s) return 'Other'
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const inputClass =
  'rounded border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export function SessionCard({
  session,
  library,
  assignmentId,
  isFirst,
  isLast,
}: {
  session: AssignedSession
  library: ExerciseLibraryRow[]
  assignmentId: string
  isFirst: boolean
  isLast: boolean
}) {
  const [open, setOpen] = useState(false)

  // Auto-expand if the URL hash points at this session or any of its sections.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    if (!hash) return
    if (hash === `#session-${session.id}`) {
      setOpen(true)
      return
    }
    const sectionMatch = session.assigned_sections.some(
      (sec) => hash === `#section-${sec.id}`,
    )
    if (sectionMatch) setOpen(true)
  }, [session.id, session.assigned_sections])

  const usedSectionTypes = new Set(
    session.assigned_sections.map((s) => s.section_type),
  )
  const availableSectionTypes = SECTION_TYPES.filter(
    (t) => !usedSectionTypes.has(t),
  )

  const totalExercises = session.assigned_sections.reduce(
    (acc, sec) => acc + sec.assigned_exercises.length,
    0,
  )
  const summary = `${session.assigned_sections.length} section${session.assigned_sections.length === 1 ? '' : 's'} · ${totalExercises} exercise${totalExercises === 1 ? '' : 's'}`

  return (
    <article
      id={`session-${session.id}`}
      className="rounded border border-border bg-card p-4 scroll-mt-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex shrink-0 flex-col">
            <form action={moveSession.bind(null, session.id, 'up')}>
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
            <form action={moveSession.bind(null, session.id, 'down')}>
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
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`session-content-${session.id}`}
            className="-mx-2 -my-1 flex min-w-0 flex-1 cursor-pointer flex-col items-start rounded-md px-2 py-1 text-left transition-colors hover:bg-secondary"
          >
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Session {session.session_index}
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden className="text-sm text-muted-foreground">
                {open ? '▾' : '▸'}
              </span>
              <span className="text-lg font-medium">{session.name}</span>
            </span>
            {!open && (
              <span className="mt-0.5 text-xs text-muted-foreground">
                {summary}
              </span>
            )}
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/admin/sessions/${session.id}/edit`}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Rename
          </Link>
          <form action={deleteSession.bind(null, session.id)}>
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

      {session.client_notes && (
        <blockquote className="mt-4 rounded-md border-l-2 border-brand bg-background px-3 py-2 text-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Client reflection
          </p>
          <p className="mt-1 whitespace-pre-wrap text-foreground">
            {session.client_notes}
          </p>
        </blockquote>
      )}

      {open && (
        <div id={`session-content-${session.id}`} className="mt-4 space-y-4">
          {session.assigned_sections.map((section, i) => (
            <SectionBlock
              key={section.id}
              section={section}
              library={library}
              assignmentId={assignmentId}
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
      )}
    </article>
  )
}

function SectionBlock({
  section,
  library,
  assignmentId,
  isFirst,
  isLast,
}: {
  section: AssignedSection
  library: ExerciseLibraryRow[]
  assignmentId: string
  isFirst: boolean
  isLast: boolean
}) {
  const filteredLibrary = library.filter((ex) => {
    const tags = ex.section_types ?? []
    return tags.length === 0 || tags.includes(section.section_type)
  })

  return (
    <section
      id={`section-${section.id}`}
      className="rounded border border-border/60 bg-background p-3 scroll-mt-4"
    >
      <header className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <form action={moveSection.bind(null, section.id, 'up')}>
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
          <form action={moveSection.bind(null, section.id, 'down')}>
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
        <form action={deleteSection.bind(null, section.id)}>
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
        <p className="mb-3 text-xs text-muted-foreground">No exercises yet.</p>
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
                      action={moveAssignedExercise.bind(null, ae.id, 'up')}
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
                      action={moveAssignedExercise.bind(null, ae.id, 'down')}
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {ae.exercises?.name ?? '(deleted exercise)'}
                      </span>
                      {ae.work_interval_seconds && (
                        <span className="rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                          EMOM {ae.work_interval_seconds}s
                        </span>
                      )}
                      {!ae.work_interval_seconds && ae.rest_seconds !== null && (
                        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                          rest {ae.rest_seconds}s
                        </span>
                      )}
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
                    {ae.exercises?.id && (
                      <Link
                        href={`/admin/assignments/${assignmentId}/exercises/${ae.exercises.id}`}
                        className={buttonVariants({ variant: 'ghost', size: 'xs' })}
                        aria-label="View this exercise across all weeks of the assignment"
                      >
                        History
                      </Link>
                    )}
                    <Link
                      href={`/admin/assigned-exercises/${ae.id}/edit`}
                      className={buttonVariants({ variant: 'ghost', size: 'xs' })}
                    >
                      Edit
                    </Link>
                    <form action={deleteAssignedExercise.bind(null, ae.id)}>
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

      {filteredLibrary.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No exercises in your library are tagged{' '}
          {sectionLabel(section.section_type)}.{' '}
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
              {section.section_type === 'strength' ? (
                <>
                  {STRENGTH_SUBCATEGORIES.map((sub) => {
                    const group = filteredLibrary.filter(
                      (ex) => ex.subcategory === sub,
                    )
                    if (group.length === 0) return null
                    return (
                      <optgroup key={sub} label={subcategoryLabel(sub)}>
                        {group.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })}
                  {(() => {
                    const other = filteredLibrary.filter(
                      (ex) =>
                        !ex.subcategory ||
                        !(STRENGTH_SUBCATEGORIES as readonly string[]).includes(
                          ex.subcategory,
                        ),
                    )
                    if (other.length === 0) return null
                    return (
                      <optgroup label="Other">
                        {other.map((ex) => (
                          <option key={ex.id} value={ex.id}>
                            {ex.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  })()}
                </>
              ) : (
                filteredLibrary.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))
              )}
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
          <label className="flex w-20 flex-col gap-1">
            <span className="text-xs text-muted-foreground">Rest (s)</span>
            <input
              name="rest_seconds"
              type="number"
              inputMode="numeric"
              min={0}
              max={7200}
              step={5}
              placeholder="—"
              className={inputClass}
            />
          </label>
          <label className="flex w-20 flex-col gap-1">
            <span className="text-xs text-muted-foreground">EMOM (s)</span>
            <input
              name="work_interval_seconds"
              type="number"
              inputMode="numeric"
              min={5}
              max={7200}
              step={5}
              placeholder="—"
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
