import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  StatusBadge,
  ASSIGNMENT_STATUS_TONE,
} from '@/components/status-badge'
import { updateClientDisplayName } from '../actions'
import { ProgressChart, type ChartPoint } from '@/components/progress-chart'

interface Assignment {
  id: string
  name: string
  start_date: string
  weeks: number
  status: 'active' | 'completed' | 'paused'
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmt(d: string) {
  return new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      display_name,
      role,
      clients_admin ( status )
    `
    )
    .eq('id', id)
    .single()

  if (profileError || !profile || profile.role !== 'client') notFound()

  const link = Array.isArray(profile.clients_admin)
    ? profile.clients_admin[0]
    : profile.clients_admin
  const clientStatus = link?.status ?? 'active'

  const { data: assignmentRows } = await supabase
    .from('client_assignments')
    .select('id, name, start_date, weeks, status')
    .eq('client_id', id)
    .order('start_date', { ascending: false })

  const assignments = (assignmentRows ?? []) as Assignment[]

  // Metrics — recent entries + weight chart
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  const { data: metricRows } = await supabase
    .from('client_metrics')
    .select('measured_on, weight_kg, sleep_hours, energy, notes')
    .eq('client_id', id)
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
  const weightLogs = metrics.filter((m) => m.weight_kg !== null)
  const fmtMetricTick = (iso: string) =>
    new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    })
  const wn = weightLogs.length
  const wTickIdx = new Set<number>(
    wn <= 4
      ? weightLogs.map((_, i) => i)
      : [0, Math.floor(wn / 3), Math.floor((2 * wn) / 3), wn - 1],
  )
  const weightChart: ChartPoint[] = weightLogs.map((m, i) => ({
    weekIndex: i + 1,
    value: m.weight_kg,
    label:
      i === 0 || i === wn - 1
        ? `${Number.parseFloat(m.weight_kg!.toString())}kg`
        : undefined,
    xAxisLabel: wTickIdx.has(i) ? fmtMetricTick(m.measured_on) : '',
  }))
  const recentMetrics = [...metrics].reverse().slice(0, 5)

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/clients"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ← Clients
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold">
            {profile.display_name || profile.email}
          </h1>
          {profile.display_name && (
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          )}
          <div className="mt-2">
            <StatusBadge tone={clientStatus === 'archived' ? 'muted' : 'brand'}>
              {clientStatus}
            </StatusBadge>
          </div>

          <form
            action={updateClientDisplayName.bind(null, id)}
            className="mt-4 flex flex-wrap items-end gap-2"
          >
            <label className="flex min-w-[220px] flex-col gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Display name
              </span>
              <input
                name="display_name"
                type="text"
                defaultValue={profile.display_name ?? ''}
                placeholder="e.g. Ruari Souter"
                className="rounded border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
            </label>
            <Button type="submit" variant="outline" size="sm">
              Save name
            </Button>
            <p className="w-full text-xs text-muted-foreground">
              Shown to you in lists. The client can&apos;t see it.
            </p>
          </form>
        </div>
        <Link
          href={`/admin/clients/${id}/assignments/new`}
          className={buttonVariants()}
        >
          New assignment
        </Link>
      </div>

      <section className="space-y-3" id="assignments">
        <h2 className="text-lg font-medium">Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No assignments yet. Create one to start authoring programmes.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {assignments.map((a) => {
              const endDate = addDays(a.start_date, a.weeks * 7 - 1)
              return (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <Link
                    href={`/admin/assignments/${a.id}`}
                    className="min-w-0 flex-1 hover:opacity-80"
                  >
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmt(a.start_date)} → {fmt(endDate)} · {a.weeks} weeks
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={ASSIGNMENT_STATUS_TONE[a.status]}>
                      {a.status}
                    </StatusBadge>
                    <Link
                      href={`/admin/assignments/${a.id}`}
                      className={buttonVariants({
                        variant: 'outline',
                        size: 'sm',
                      })}
                    >
                      Open
                    </Link>
                    <Link
                      href={`/admin/assignments/${a.id}/delete`}
                      className={buttonVariants({
                        variant: 'ghost',
                        size: 'sm',
                      })}
                      aria-label={`Delete ${a.name}`}
                    >
                      <span className="text-destructive">Delete</span>
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Metrics</h2>
        {metrics.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No check-ins logged yet.
          </p>
        ) : (
          <>
            {weightChart.length >= 2 && (
              <ProgressChart
                points={weightChart}
                yLabel="Weight (kg)"
                height={160}
              />
            )}
            <ul className="divide-y divide-border rounded border border-border">
              {recentMetrics.map((m) => (
                <li
                  key={m.measured_on}
                  className="flex items-center justify-between gap-4 p-3 text-sm"
                >
                  <span className="font-medium tabular-nums">
                    {fmt(m.measured_on)}
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {m.weight_kg !== null && (
                      <span className="rounded-md bg-muted px-2 py-0.5 tabular-nums text-foreground">
                        {Number.parseFloat(m.weight_kg.toString())} kg
                      </span>
                    )}
                    {m.sleep_hours !== null && (
                      <span className="rounded-md bg-muted px-2 py-0.5 tabular-nums">
                        {Number.parseFloat(m.sleep_hours.toString())}h sleep
                      </span>
                    )}
                    {m.energy !== null && (
                      <span className="rounded-md bg-muted px-2 py-0.5">
                        energy {m.energy}/5
                      </span>
                    )}
                    {m.notes && (
                      <span className="max-w-[14rem] truncate italic">
                        “{m.notes}”
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3 pt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Danger zone
        </h2>
        <div className="rounded border border-destructive/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium">Delete this client</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Permanently removes the account and all programme data. No undo.
              </p>
            </div>
            <Link
              href={`/admin/clients/${id}/delete`}
              className={buttonVariants({
                variant: 'destructive',
                size: 'sm',
              })}
            >
              Delete client
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
