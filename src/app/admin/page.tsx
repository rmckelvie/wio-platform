import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/dates'

interface Reflection {
  client_id: string
  client_name: string
  session_name: string
  session_id: string
  week_id: string
  week_index: number
  client_notes: string
  updated_at: string | null
}

interface StalledClient {
  client_id: string
  client_name: string
  weekId: string
  weekIndex: number
  release_date: string
  days_since_log: number | null
}

interface UpcomingRelease {
  weekId: string
  weekIndex: number
  release_date: string
  client_id: string
  client_name: string
  assignment_id: string
  assignment_name: string
}

function nameOf(p: { email: string; display_name: string | null } | null): string {
  return p?.display_name || p?.email || 'client'
}

function daysAgo(iso: string): number {
  const d = new Date(iso).getTime()
  if (!Number.isFinite(d)) return Infinity
  return Math.floor((Date.now() - d) / (1000 * 60 * 60 * 24))
}

export default async function AdminHome() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)
  const sevenDaysAgoIso = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString()

  // Run all read queries in parallel for snappy load
  const [
    activeClientsRes,
    sessionsThisWeekRes,
    setsThisWeekRes,
    reflectionsRes,
    upcomingRes,
    activeWeeksWithLogsRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'client'),
    supabase
      .from('assigned_sessions')
      .select('id', { count: 'exact', head: true })
      .gte('completed_at', sevenDaysAgoIso),
    supabase
      .from('exercise_logs')
      .select('id', { count: 'exact', head: true })
      .gte('logged_at', sevenDaysAgoIso),
    // Recent client reflections — pull a wider net and dedupe in JS
    supabase
      .from('assigned_sessions')
      .select(
        `
        id, name, client_notes,
        assignment_weeks!inner (
          id, week_index,
          client_assignments!inner (
            client_id, status,
            profiles ( email, display_name )
          )
        )
      `,
      )
      .not('client_notes', 'is', null)
      .limit(20),
    // Weeks unlocking in the next 7 days (today inclusive .. +7)
    supabase
      .from('assignment_weeks')
      .select(
        `
        id, week_index, release_date,
        client_assignments!inner (
          id, name, client_id, status,
          profiles ( email, display_name )
        )
      `,
      )
      .gte('release_date', today)
      .lte(
        'release_date',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10),
      )
      .eq('client_assignments.status', 'active')
      .order('release_date', { ascending: true }),
    // For stalled-clients detection: most recent released week per active
    // client + that client's most recent log time
    supabase
      .from('assignment_weeks')
      .select(
        `
        id, week_index, release_date,
        client_assignments!inner (
          id, client_id, status,
          profiles ( email, display_name )
        )
      `,
      )
      .lte('release_date', today)
      .eq('client_assignments.status', 'active')
      .order('release_date', { ascending: false }),
  ])

  // Most recent log per client (for "days since last log")
  const { data: lastLogsByClient } = await supabase
    .from('exercise_logs')
    .select(
      `
      logged_at,
      assigned_exercises!inner (
        assigned_sections!inner (
          assigned_sessions!inner (
            assignment_weeks!inner (
              client_assignments!inner ( client_id )
            )
          )
        )
      )
    `,
    )
    .order('logged_at', { ascending: false })
    .limit(500)

  type LogRow = {
    logged_at: string
    assigned_exercises: {
      assigned_sections: {
        assigned_sessions: {
          assignment_weeks: {
            client_assignments: { client_id: string }
          }
        }
      }
    }
  }
  const lastLogByClient = new Map<string, string>()
  for (const row of (lastLogsByClient ?? []) as unknown as LogRow[]) {
    const cid =
      row.assigned_exercises?.assigned_sections?.assigned_sessions
        ?.assignment_weeks?.client_assignments?.client_id
    if (cid && !lastLogByClient.has(cid)) {
      lastLogByClient.set(cid, row.logged_at)
    }
  }

  // Build reflections list
  type ReflectionRow = {
    id: string
    name: string
    client_notes: string | null
    assignment_weeks: {
      id: string
      week_index: number
      client_assignments: {
        client_id: string
        status: string
        profiles: { email: string; display_name: string | null } | null
      }
    }
  }
  const reflections: Reflection[] = ((reflectionsRes.data ?? []) as unknown as ReflectionRow[])
    .filter((r) => !!r.client_notes && r.client_notes.trim().length > 0)
    .slice(0, 5)
    .map((r) => ({
      client_id: r.assignment_weeks.client_assignments.client_id,
      client_name: nameOf(r.assignment_weeks.client_assignments.profiles),
      session_name: r.name,
      session_id: r.id,
      week_id: r.assignment_weeks.id,
      week_index: r.assignment_weeks.week_index,
      client_notes: r.client_notes!,
      updated_at: null,
    }))

  // Build upcoming releases
  type UpcomingRow = {
    id: string
    week_index: number
    release_date: string
    client_assignments: {
      id: string
      name: string
      client_id: string
      status: string
      profiles: { email: string; display_name: string | null } | null
    }
  }
  const upcoming: UpcomingRelease[] = (
    (upcomingRes.data ?? []) as unknown as UpcomingRow[]
  ).map((r) => ({
    weekId: r.id,
    weekIndex: r.week_index,
    release_date: r.release_date,
    client_id: r.client_assignments.client_id,
    client_name: nameOf(r.client_assignments.profiles),
    assignment_id: r.client_assignments.id,
    assignment_name: r.client_assignments.name,
  }))

  // Stalled clients: most recent released week per client; no logs in 5+ days
  type ActiveWeekRow = {
    id: string
    week_index: number
    release_date: string
    client_assignments: {
      id: string
      client_id: string
      status: string
      profiles: { email: string; display_name: string | null } | null
    }
  }
  const latestWeekByClient = new Map<string, ActiveWeekRow>()
  for (const r of (activeWeeksWithLogsRes.data ?? []) as unknown as ActiveWeekRow[]) {
    const cid = r.client_assignments.client_id
    if (!latestWeekByClient.has(cid)) {
      latestWeekByClient.set(cid, r)
    }
  }

  const STALL_THRESHOLD = 5
  const stalled: StalledClient[] = []
  for (const [cid, row] of latestWeekByClient.entries()) {
    const lastLog = lastLogByClient.get(cid)
    const daysSinceLog = lastLog ? daysAgo(lastLog) : null
    const released = row.release_date <= today
    if (!released) continue
    if (daysSinceLog === null || daysSinceLog >= STALL_THRESHOLD) {
      stalled.push({
        client_id: cid,
        client_name: nameOf(row.client_assignments.profiles),
        weekId: row.id,
        weekIndex: row.week_index,
        release_date: row.release_date,
        days_since_log: daysSinceLog,
      })
    }
  }
  stalled.sort(
    (a, b) => (b.days_since_log ?? 999) - (a.days_since_log ?? 999),
  )

  const stats = {
    activeClients: activeClientsRes.count ?? 0,
    sessionsThisWeek: sessionsThisWeekRes.count ?? 0,
    setsThisWeek: setsThisWeekRes.count ?? 0,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activity across all clients in the last 7 days.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Clients" value={stats.activeClients} />
        <StatCard label="Sessions completed (7d)" value={stats.sessionsThisWeek} />
        <StatCard label="Sets logged (7d)" value={stats.setsThisWeek} />
      </div>

      {/* Two-column split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent reflections */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recent reflections
          </h2>
          {reflections.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              No reflections written yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {reflections.map((r) => (
                <li
                  key={r.session_id}
                  className="rounded-lg border border-border bg-card p-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {r.client_name}
                    </span>
                    <Link
                      href={`/admin/weeks/${r.week_id}`}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Week {r.week_index} · {r.session_name}
                    </Link>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">
                    {r.client_notes}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {/* Stalled clients */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Stalled clients · 5+ days since a log
            </h2>
            {stalled.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Everyone&apos;s on track.
              </p>
            ) : (
              <ul className="space-y-2">
                {stalled.slice(0, 6).map((s) => (
                  <li key={s.client_id}>
                    <Link
                      href={`/admin/clients/${s.client_id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:border-brand/60"
                    >
                      <span className="font-medium">{s.client_name}</span>
                      <StatusBadge
                        tone={
                          s.days_since_log === null || s.days_since_log > 14
                            ? 'destructive'
                            : 'warn'
                        }
                      >
                        {s.days_since_log === null
                          ? 'never logged'
                          : `${s.days_since_log}d`}
                      </StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Upcoming releases */}
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Releasing in the next 7 days
            </h2>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                Nothing scheduled to unlock.
              </p>
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 6).map((u) => (
                  <li key={u.weekId}>
                    <Link
                      href={`/admin/weeks/${u.weekId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm transition-colors hover:border-brand/60"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">{u.client_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.assignment_name} · Week {u.weekIndex}
                        </div>
                      </div>
                      <StatusBadge tone="neutral">
                        {formatDate(u.release_date)}
                      </StatusBadge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Quick links */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-6">
        <Link href="/admin/clients" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          All clients
        </Link>
        <Link href="/admin/exercises" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Exercise library
        </Link>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
}: {
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-3xl font-semibold tabular-nums">{value}</div>
    </div>
  )
}
