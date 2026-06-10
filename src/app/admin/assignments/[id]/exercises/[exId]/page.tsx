import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/dates'
import { sectionLabel, type SectionType } from '@/lib/sections'
import { StatusBadge } from '@/components/status-badge'
import { ProgressChart, type ChartPoint } from '@/components/progress-chart'

interface ExerciseLog {
  id: string
  set_number: number
  weight_kg: number | null
  reps_done: number | null
  rpe: number | null
  logged_at: string
}

interface AssignedExerciseRow {
  id: string
  prescribed_sets: string | null
  prescribed_reps: string | null
  notes: string | null
  exercise_id: string
  exercise_logs: ExerciseLog[]
  assigned_sections: {
    section_type: SectionType
    assigned_sessions: {
      session_index: number
      name: string
      assignment_weeks: {
        id: string
        week_index: number
        name: string | null
        release_date: string
        assignment_id: string
      }
    }
  }
}

interface PerWeek {
  weekId: string
  weekIndex: number
  weekName: string | null
  releaseDate: string
  rows: Array<{
    aeId: string
    sessionName: string
    sessionIndex: number
    sectionType: SectionType
    prescribed: string | null
    notes: string | null
    logs: ExerciseLog[]
  }>
}

export default async function CrossWeekExercisePage({
  params,
}: {
  params: Promise<{ id: string; exId: string }>
}) {
  const { id: assignmentId, exId } = await params

  const supabase = await createClient()

  const [assignmentRes, exerciseRes, rowsRes] = await Promise.all([
    supabase
      .from('client_assignments')
      .select(
        `
        id, name, weeks, start_date, client_id,
        profiles!inner ( email, display_name )
      `,
      )
      .eq('id', assignmentId)
      .single(),
    supabase
      .from('exercises')
      .select('id, name, video_url')
      .eq('id', exId)
      .single(),
    supabase
      .from('assigned_exercises')
      .select(
        `
        id, prescribed_sets, prescribed_reps, notes, exercise_id,
        exercise_logs ( id, set_number, weight_kg, reps_done, rpe, logged_at ),
        assigned_sections!inner (
          section_type,
          assigned_sessions!inner (
            session_index, name,
            assignment_weeks!inner (
              id, week_index, name, release_date, assignment_id
            )
          )
        )
      `,
      )
      .eq('exercise_id', exId)
      .eq(
        'assigned_sections.assigned_sessions.assignment_weeks.assignment_id',
        assignmentId,
      ),
  ])

  if (
    assignmentRes.error ||
    !assignmentRes.data ||
    exerciseRes.error ||
    !exerciseRes.data
  ) {
    notFound()
  }

  const assignment = assignmentRes.data as unknown as {
    id: string
    name: string
    weeks: number
    start_date: string
    client_id: string
    profiles: { email: string; display_name: string | null } | null
  }
  const exercise = exerciseRes.data
  const rows = (rowsRes.data ?? []) as unknown as AssignedExerciseRow[]

  // Group by week
  const byWeek = new Map<string, PerWeek>()
  for (const r of rows) {
    const wk = r.assigned_sections.assigned_sessions.assignment_weeks
    const existing = byWeek.get(wk.id)
    if (!existing) {
      byWeek.set(wk.id, {
        weekId: wk.id,
        weekIndex: wk.week_index,
        weekName: wk.name,
        releaseDate: wk.release_date,
        rows: [],
      })
    }
    const prescribed =
      [r.prescribed_sets, r.prescribed_reps].filter(Boolean).join(' × ') || null
    byWeek.get(wk.id)!.rows.push({
      aeId: r.id,
      sessionName: r.assigned_sections.assigned_sessions.name,
      sessionIndex: r.assigned_sections.assigned_sessions.session_index,
      sectionType: r.assigned_sections.section_type,
      prescribed,
      notes: r.notes,
      logs: [...r.exercise_logs].sort((a, b) => a.set_number - b.set_number),
    })
  }

  const weeks = Array.from(byWeek.values()).sort(
    (a, b) => a.weekIndex - b.weekIndex,
  )

  const clientName =
    assignment.profiles?.display_name || assignment.profiles?.email || 'client'

  // Build chart points: max weight logged per week (across any session/set)
  const chartPoints: ChartPoint[] = weeks.map((w) => {
    let bestWeight: number | null = null
    let bestReps: number | null = null
    for (const r of w.rows) {
      for (const log of r.logs) {
        if (log.weight_kg === null) continue
        if (bestWeight === null || log.weight_kg > bestWeight) {
          bestWeight = log.weight_kg
          bestReps = log.reps_done
        }
      }
    }
    let label: string | undefined
    if (bestWeight !== null) {
      const wStr = Number.parseFloat(bestWeight.toString()).toString()
      label =
        bestReps !== null ? `${wStr}kg × ${bestReps}` : `${wStr}kg`
    }
    return {
      weekIndex: w.weekIndex,
      value: bestWeight,
      label,
    }
  })

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/admin/assignments/${assignmentId}`}
          className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          ← {assignment.name}
        </Link>
        <span className="mx-2 text-muted-foreground">·</span>
        <Link
          href={`/admin/clients/${assignment.client_id}`}
          className="text-muted-foreground transition-colors hover:text-foreground hover:underline"
        >
          {clientName}
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold">{exercise.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Across {assignment.weeks} weeks of {assignment.name}
        </p>
        {exercise.video_url && (
          <a
            href={exercise.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-brand underline-offset-4 hover:underline"
          >
            Watch demo
          </a>
        )}
      </header>

      {weeks.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Top set per week
          </h2>
          <ProgressChart points={chartPoints} yLabel="Heaviest set (kg)" />
        </section>
      )}

      {weeks.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This exercise hasn&apos;t been prescribed in any week of this
          assignment yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {weeks.map((w) => (
            <li
              key={w.weekId}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="mb-3 flex items-center gap-2">
                <Link
                  href={`/admin/weeks/${w.weekId}`}
                  className="font-medium hover:underline"
                >
                  Week {w.weekIndex}
                  {w.weekName ? ` — ${w.weekName}` : ''}
                </Link>
                <StatusBadge tone="neutral">
                  {formatDate(w.releaseDate)}
                </StatusBadge>
              </div>

              <ul className="space-y-2.5">
                {w.rows.map((r) => (
                  <li
                    key={r.aeId}
                    className="rounded border border-border/60 bg-background p-3"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">
                        Session {r.sessionIndex} · {r.sessionName} ·{' '}
                        <span className="text-brand">
                          {sectionLabel(r.sectionType)}
                        </span>
                      </span>
                      <span className="tabular-nums text-foreground">
                        {r.prescribed ?? '—'}
                      </span>
                    </div>
                    {r.notes && (
                      <p className="mb-1.5 text-xs text-muted-foreground">
                        {r.notes}
                      </p>
                    )}
                    {r.logs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No sets logged.
                      </p>
                    ) : (
                      <ul className="flex flex-wrap gap-1.5">
                        {r.logs.map((log) => (
                          <li
                            key={log.id}
                            className="rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-xs tabular-nums text-brand"
                          >
                            <span className="opacity-70">
                              #{log.set_number}{' '}
                            </span>
                            {log.weight_kg !== null
                              ? `${Number.parseFloat(log.weight_kg.toString())}kg`
                              : '—'}
                            {log.reps_done !== null && (
                              <span> × {log.reps_done}</span>
                            )}
                            {log.rpe !== null && (
                              <span className="opacity-70">
                                {' '}
                                · RPE {log.rpe}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
