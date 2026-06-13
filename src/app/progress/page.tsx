import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { WioLogo } from '@/components/wio-logo'
import { ProgressChart, type ChartPoint } from '@/components/progress-chart'
import { buttonVariants } from '@/components/ui/button'

interface MetricRow {
  measured_on: string
  weight_kg: number | null
}

interface LoggedExerciseRow {
  id: string
  weight_kg: number | null
  reps_done: number | null
  rpe: number | null
  logged_at: string
  assigned_exercise_id: string
  assigned_exercises: {
    exercise_id: string
    exercises: { id: string; name: string } | null
  } | null
}

function fmtTickDate(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  })
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function buildSparseTickIndices(n: number): Set<number> {
  if (n <= 4) return new Set(Array.from({ length: n }, (_, i) => i))
  return new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1])
}

function metricChart(
  rows: Array<{ date: string; value: number | null }>,
  unitLabel: (v: number) => string,
): ChartPoint[] {
  const populated = rows.filter((r) => r.value !== null)
  const n = populated.length
  if (n === 0) return []
  const tickIdx = buildSparseTickIndices(n)
  return populated.map((r, i) => ({
    weekIndex: i + 1,
    value: r.value,
    label: i === 0 || i === n - 1 ? unitLabel(r.value!) : undefined,
    xAxisLabel: tickIdx.has(i) ? fmtTickDate(r.date) : '',
  }))
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>
}) {
  const me = await requireUser()
  const { exercise: selectedExerciseId } = await searchParams

  const supabase = await createClient()

  // ---- Metrics window: last 90 days ----
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: metricRows } = await supabase
    .from('client_metrics')
    .select('measured_on, weight_kg')
    .eq('client_id', me.id)
    .gte('measured_on', ninetyDaysAgo)
    .order('measured_on', { ascending: true })

  const metrics = (metricRows ?? []) as MetricRow[]

  const weightChart = metricChart(
    metrics.map((m) => ({ date: m.measured_on, value: m.weight_kg })),
    (v) => `${Number.parseFloat(v.toString())} kg`,
  )

  // ---- Exercises the client has logged (for the picker) ----
  const { data: loggedRows } = await supabase
    .from('exercise_logs')
    .select(
      `
      id, weight_kg, reps_done, rpe, logged_at, assigned_exercise_id,
      assigned_exercises!inner (
        exercise_id,
        exercises ( id, name )
      )
    `,
    )
    .order('logged_at', { ascending: false })
    .limit(1000)

  const loggedExercises = (loggedRows ?? []) as unknown as LoggedExerciseRow[]

  // Build unique exercise list with most-recent log timestamp
  const exerciseLastSeen = new Map<
    string,
    { id: string; name: string; latest: string }
  >()
  for (const log of loggedExercises) {
    const ex = log.assigned_exercises?.exercises
    if (!ex?.id) continue
    const existing = exerciseLastSeen.get(ex.id)
    if (!existing || log.logged_at > existing.latest) {
      exerciseLastSeen.set(ex.id, {
        id: ex.id,
        name: ex.name,
        latest: log.logged_at,
      })
    }
  }
  const exerciseOptions = Array.from(exerciseLastSeen.values()).sort(
    (a, b) => a.name.localeCompare(b.name),
  )

  // ---- Per-exercise top-set-per-session chart ----
  let exerciseTitle: string | null = null
  let exerciseChart: ChartPoint[] = []
  let exerciseAllTimeMax: { weight: number; reps: number; on: string } | null =
    null

  const effectiveExerciseId =
    selectedExerciseId && exerciseLastSeen.has(selectedExerciseId)
      ? selectedExerciseId
      : exerciseOptions[0]?.id ?? null

  if (effectiveExerciseId) {
    exerciseTitle = exerciseLastSeen.get(effectiveExerciseId)?.name ?? null

    // Group this exercise's logs by assigned_exercise_id (one session per AE)
    // and take the top-weight set per session.
    const relevant = loggedExercises.filter(
      (log) => log.assigned_exercises?.exercise_id === effectiveExerciseId,
    )
    const bySession = new Map<string, LoggedExerciseRow[]>()
    for (const log of relevant) {
      const arr = bySession.get(log.assigned_exercise_id) ?? []
      arr.push(log)
      bySession.set(log.assigned_exercise_id, arr)
    }

    type TopSet = { date: string; weight: number; reps: number }
    const topSets: TopSet[] = []
    for (const logs of bySession.values()) {
      let top: LoggedExerciseRow | null = null
      for (const log of logs) {
        if (log.weight_kg === null) continue
        if (top === null || log.weight_kg > (top.weight_kg ?? -Infinity)) {
          top = log
        }
      }
      if (top && top.weight_kg !== null) {
        topSets.push({
          date: top.logged_at.slice(0, 10),
          weight: top.weight_kg,
          reps: top.reps_done ?? 0,
        })
      }
    }
    topSets.sort((a, b) => a.date.localeCompare(b.date))

    if (topSets.length > 0) {
      const n = topSets.length
      const tickIdx = buildSparseTickIndices(n)
      exerciseChart = topSets.map((t, i) => ({
        weekIndex: i + 1,
        value: t.weight,
        label:
          i === 0 || i === n - 1
            ? `${Number.parseFloat(t.weight.toString())}kg × ${t.reps}`
            : undefined,
        xAxisLabel: tickIdx.has(i) ? fmtTickDate(t.date) : '',
      }))

      let best = topSets[0]
      for (const t of topSets) {
        if (t.weight > best.weight) best = t
      }
      exerciseAllTimeMax = { weight: best.weight, reps: best.reps, on: best.date }
    }
  }

  // ---- Recent PRs across all exercises ----
  // Walk the entire log history (most recent first), bucket by library
  // exercise, then run forward through each bucket to flag PR rows.
  type LogPR = {
    id: string
    weight: number
    reps: number
    logged_at: string
    exercise_id: string
    exercise_name: string
  }
  const byExerciseId = new Map<string, LoggedExerciseRow[]>()
  for (const log of loggedExercises) {
    const exId = log.assigned_exercises?.exercise_id
    if (!exId) continue
    const arr = byExerciseId.get(exId) ?? []
    arr.push(log)
    byExerciseId.set(exId, arr)
  }
  const prs: LogPR[] = []
  for (const [exId, logs] of byExerciseId.entries()) {
    logs.sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    let runMax = -Infinity
    for (const log of logs) {
      if (log.weight_kg === null) continue
      if (log.weight_kg > runMax) {
        runMax = log.weight_kg
        prs.push({
          id: log.id,
          weight: log.weight_kg,
          reps: log.reps_done ?? 0,
          logged_at: log.logged_at,
          exercise_id: exId,
          exercise_name:
            log.assigned_exercises?.exercises?.name ?? '(deleted exercise)',
        })
      }
    }
  }
  prs.sort((a, b) => b.logged_at.localeCompare(a.logged_at))
  const recentPRs = prs.slice(0, 8)

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-12 pt-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          aria-label="Back to dashboard"
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          <span aria-hidden>←</span>
          Back
        </Link>
        <WioLogo variant="mark" size={120} />
      </header>

      <div className="mb-8">
        <p className="text-xs uppercase tracking-wide text-brand">Progress</p>
        <h1 className="mt-1 text-2xl font-semibold">How you&apos;re tracking</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Last 90 days · {metrics.length} check-in
          {metrics.length === 1 ? '' : 's'}
        </p>
      </div>

      {/* Body weight */}
      <section className="mb-8">
        <ChartBlock
          title="Body weight"
          subtitle={
            weightChart.length === 0
              ? 'Log a weight on your dashboard to start a trend.'
              : `${weightChart.length} entries`
          }
          chart={weightChart}
          yLabel="Weight (kg)"
        />
      </section>

      {/* Exercise progression */}
      <section className="mb-8 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Exercise progression
        </h2>
        {exerciseOptions.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Log a few sets in a session to start tracking strength
            progression per exercise.
          </p>
        ) : (
          <>
            <form className="rounded-xl border border-border bg-card p-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Choose an exercise
                </span>
                <select
                  name="exercise"
                  defaultValue={effectiveExerciseId ?? ''}
                  className="rounded-lg border border-input bg-background px-3 py-3 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                >
                  {exerciseOptions.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              </label>
              {/* Submit-on-change via a small JS-less form: a hidden submit
                  button so iOS Safari accepts the select-change → form-submit
                  even without explicit onChange handler. We rely on the
                  user picking "Update" — keeps it server-component-friendly. */}
              <button
                type="submit"
                className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-md border border-border bg-card text-sm font-medium active:bg-secondary"
              >
                Show chart
              </button>
            </form>

            {exerciseChart.length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                No logged weights for {exerciseTitle ?? 'this exercise'} yet.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-medium">{exerciseTitle}</h3>
                  {exerciseAllTimeMax && (
                    <span className="text-xs text-muted-foreground">
                      Best:{' '}
                      <span className="text-foreground">
                        {Number.parseFloat(
                          exerciseAllTimeMax.weight.toString(),
                        )}
                        kg × {exerciseAllTimeMax.reps}
                      </span>{' '}
                      on {fmtTickDate(exerciseAllTimeMax.on)}
                    </span>
                  )}
                </div>
                <ProgressChart
                  points={exerciseChart}
                  yLabel="Top set (kg)"
                  height={200}
                />
              </div>
            )}
          </>
        )}
      </section>

      {/* Recent PRs */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          Recent personal records
        </h2>
        {recentPRs.length === 0 ? (
          <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            No PRs yet — keep logging and they&apos;ll start appearing.
          </p>
        ) : (
          <ul className="space-y-2">
            {recentPRs.map((pr) => (
              <li
                key={pr.id}
                className="rounded-xl border border-brand/40 bg-brand/10 p-3"
              >
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-medium">{pr.exercise_name}</span>
                  <span aria-hidden className="text-xs text-brand">
                    🏆 PR
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    {Number.parseFloat(pr.weight.toString())}kg × {pr.reps}
                  </span>
                  <span>{fmtFull(pr.logged_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

function ChartBlock({
  title,
  subtitle,
  chart,
  yLabel,
}: {
  title: string
  subtitle: string
  chart: ChartPoint[]
  yLabel: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {title}
        </h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {chart.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
          Nothing to chart yet.
        </p>
      ) : (
        <ProgressChart points={chart} yLabel={yLabel} height={160} />
      )}
    </div>
  )
}
