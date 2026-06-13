import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logout, saveMetric } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'
import { formatDate } from '@/lib/dates'
import { InstallAppButton } from '@/components/install-app-button'
import { MetricsTracker } from '@/components/metrics-tracker'
import { ProgressChart, type ChartPoint } from '@/components/progress-chart'

interface SessionRow {
  id: string
  session_index: number
  name: string
  completed_at: string | null
}

interface WeekRow {
  id: string
  week_index: number
  name: string | null
  release_date: string
  client_assignments: {
    id: string
    name: string
    status: 'active' | 'completed' | 'paused'
    weeks: number
  } | null
  assigned_sessions: SessionRow[]
}

export default async function DashboardPage() {
  const me = await requireUser()

  if (me.role === 'admin') {
    return <AdminLanding email={me.email} />
  }

  // Client view. RLS already restricts to:
  //   client_id = auth.uid() AND release_date <= today
  // So we just have to pick the latest released week per active assignment.
  const supabase = await createClient()
  const { data: weekRows } = await supabase
    .from('assignment_weeks')
    .select(
      `
      id, week_index, name, release_date,
      client_assignments!inner ( id, name, status, weeks ),
      assigned_sessions ( id, session_index, name, completed_at )
    `,
    )
    .eq('client_assignments.status', 'active')
    .order('week_index', { ascending: false })

  const allWeeks = (weekRows ?? []) as unknown as WeekRow[]

  // Group by assignment, take the highest-index released week per assignment
  const currentPerAssignment = new Map<string, WeekRow>()
  for (const w of allWeeks) {
    if (!w.client_assignments) continue
    const aId = w.client_assignments.id
    if (!currentPerAssignment.has(aId)) {
      currentPerAssignment.set(aId, w)
    }
  }
  const currentWeeks = Array.from(currentPerAssignment.values())

  // Metrics — today's check-in + recent weight trend
  const today = new Date().toISOString().slice(0, 10)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const { data: metricRows } = await supabase
    .from('client_metrics')
    .select('measured_on, weight_kg, sleep_hours, energy, notes')
    .eq('client_id', me.id)
    .gte('measured_on', sixtyDaysAgo)
    .order('measured_on', { ascending: true })

  type MetricRow = {
    measured_on: string
    weight_kg: number | null
    sleep_hours: number | null
    energy: number | null
    notes: string | null
  }
  const metrics = (metricRows ?? []) as MetricRow[]
  const todayMetric = metrics.find((m) => m.measured_on === today) ?? null

  // Build a weight chart: one point per logged-weight day. Show date
  // labels only on the first / last / a couple of intermediate points
  // so the X-axis stays readable.
  const weightLogs = metrics.filter((m) => m.weight_kg !== null)
  const fmtTick = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  const n = weightLogs.length
  const tickIndices = new Set<number>(
    n <= 4
      ? weightLogs.map((_, i) => i)
      : [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1],
  )
  const weightChart: ChartPoint[] = weightLogs.map((m, i) => ({
    weekIndex: i + 1,
    value: m.weight_kg,
    label:
      i === 0 || i === n - 1
        ? `${Number.parseFloat(m.weight_kg!.toString())}kg`
        : undefined,
    xAxisLabel: tickIndices.has(i) ? fmtTick(m.measured_on) : '',
  }))

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-12 pt-8">
      <header className="mb-8 flex items-center justify-between">
        <form action={logout}>
          <Button type="submit" variant="ghost" size="sm">
            Log out
          </Button>
        </form>
        <WioLogo variant="mark" size={192} />
      </header>

      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
        Signed in as
      </div>
      <div className="mb-4 text-sm">{me.email}</div>

      <div className="mb-6">
        <InstallAppButton />
      </div>

      <div className="mb-8">
        <MetricsTracker
          action={saveMetric}
          today={today}
          existing={
            todayMetric && {
              weight_kg: todayMetric.weight_kg,
              sleep_hours: todayMetric.sleep_hours,
              energy: todayMetric.energy,
              notes: todayMetric.notes,
            }
          }
        />
      </div>

      {weightChart.length >= 2 && (
        <section className="mb-8">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Weight trend · last {weightLogs.length} entries
            </h2>
            <Link
              href="/progress"
              className={buttonVariants({ variant: 'outline', size: 'xs' })}
            >
              See progress →
            </Link>
          </div>
          <ProgressChart points={weightChart} yLabel="Weight (kg)" />
        </section>
      )}

      {weightChart.length < 2 && me.role === 'client' && (
        <div className="mb-6 text-center">
          <Link
            href="/progress"
            className={buttonVariants({ variant: 'outline' })}
          >
            View your progress →
          </Link>
        </div>
      )}

      {currentWeeks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Your trainer hasn&apos;t assigned a programme yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            You&apos;ll see it here as soon as they do.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {currentWeeks.map((w) => {
            const a = w.client_assignments!
            const sessions = [...w.assigned_sessions].sort(
              (x, y) => x.session_index - y.session_index,
            )
            return (
              <section key={w.id} className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-brand">
                    {a.name}
                  </p>
                  <h1 className="text-2xl font-semibold">
                    Week {w.week_index} of {a.weeks}
                  </h1>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Released {formatDate(w.release_date)}
                  </p>
                </div>

                {sessions.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                    This week has no sessions yet. Check back soon.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {sessions.map((s) => {
                      const done = !!s.completed_at
                      return (
                        <li key={s.id}>
                          <Link
                            href={`/sessions/${s.id}`}
                            className={`flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors ${
                              done
                                ? 'border-brand/40 bg-brand/10'
                                : 'border-border bg-card hover:border-brand/60 hover:bg-secondary'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                                Session {s.session_index}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-medium">
                                  {s.name}
                                </span>
                                {done && (
                                  <span
                                    aria-label="Session completed"
                                    className="rounded-full border border-brand/40 bg-brand/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand"
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              aria-hidden
                              className="text-2xl text-muted-foreground"
                            >
                              →
                            </span>
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}

function AdminLanding({ email }: { email: string }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <WioLogo variant="mark" size={144} />
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {email} <span className="text-brand">·</span> admin
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
          Open admin
        </Link>
      </div>

      <div className="mb-6">
        <InstallAppButton />
      </div>

      <form action={logout}>
        <Button type="submit" variant="ghost">
          Log out
        </Button>
      </form>
    </main>
  )
}
