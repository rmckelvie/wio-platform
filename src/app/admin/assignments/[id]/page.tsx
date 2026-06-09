import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatDate, addDays } from '@/lib/dates'
import { setAssignmentStatus } from './actions'
import {
  StatusBadge,
  ASSIGNMENT_STATUS_TONE,
} from '@/components/status-badge'

interface Assignment {
  id: string
  name: string
  start_date: string
  weeks: number
  status: 'active' | 'completed' | 'paused'
  notes: string | null
  client_id: string
  profiles: {
    email: string
    display_name: string | null
  } | null
}

interface Week {
  id: string
  week_index: number
  name: string | null
  release_date: string
  sessions: { id: string; completed_at: string | null }[]
}

export default async function AssignmentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error: errMsg } = await searchParams

  const supabase = await createClient()

  const { data: assignmentRow, error } = await supabase
    .from('client_assignments')
    .select(
      `
      id, name, start_date, weeks, status, notes, client_id,
      profiles!inner ( email, display_name )
    `
    )
    .eq('id', id)
    .single()

  if (error || !assignmentRow) notFound()

  const a = assignmentRow as unknown as Assignment

  const { data: weekRows } = await supabase
    .from('assignment_weeks')
    .select(
      `
      id, week_index, name, release_date,
      sessions:assigned_sessions ( id, completed_at )
    `
    )
    .eq('assignment_id', id)
    .order('week_index', { ascending: true })

  const weeks = (weekRows ?? []) as Week[]

  const clientName = a.profiles?.display_name || a.profiles?.email || 'client'
  const endDate = addDays(a.start_date, a.weeks * 7 - 1)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-8">
      <div className="text-sm">
        <Link
          href={`/admin/clients/${a.client_id}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← {clientName}
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{a.name}</h1>
            <StatusBadge tone={ASSIGNMENT_STATUS_TONE[a.status]}>
              {a.status}
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(a.start_date)} → {formatDate(endDate)} · {a.weeks} weeks
          </p>
          {a.notes && (
            <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm text-muted-foreground">
              {a.notes}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/admin/assignments/${a.id}/edit`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Edit
          </Link>
          {a.status !== 'paused' && (
            <form
              action={async () => {
                'use server'
                await setAssignmentStatus(a.id, 'paused')
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Pause
              </Button>
            </form>
          )}
          {a.status === 'paused' && (
            <form
              action={async () => {
                'use server'
                await setAssignmentStatus(a.id, 'active')
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Resume
              </Button>
            </form>
          )}
          {a.status !== 'completed' && (
            <form
              action={async () => {
                'use server'
                await setAssignmentStatus(a.id, 'completed')
              }}
            >
              <Button type="submit" variant="ghost" size="sm">
                Complete
              </Button>
            </form>
          )}
        </div>
      </header>

      {errMsg && (
        <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {decodeURIComponent(errMsg)}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Weeks</h2>
        {weeks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No weeks scaffolded yet — this should not happen. Try recreating the
            assignment.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {weeks.map((w) => {
              const released = w.release_date <= today
              const sessions = w.sessions ?? []
              const sessionCount = sessions.length
              const completeCount = sessions.filter((s) => !!s.completed_at).length
              const allComplete = sessionCount > 0 && completeCount === sessionCount
              return (
                <li
                  key={w.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <Link
                    href={`/admin/weeks/${w.id}`}
                    className="min-w-0 flex-1 transition-opacity hover:opacity-80"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        Week {w.week_index}
                        {w.name ? ` — ${w.name}` : ''}
                      </span>
                      {!released && (
                        <StatusBadge tone="neutral">
                          unlocks {formatDate(w.release_date)}
                        </StatusBadge>
                      )}
                      {sessionCount > 0 && (
                        <StatusBadge tone={allComplete ? 'brand' : 'muted'}>
                          {completeCount}/{sessionCount} complete
                        </StatusBadge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {sessionCount === 0
                        ? 'No sessions yet'
                        : `${sessionCount} session${sessionCount === 1 ? '' : 's'}`}
                    </div>
                  </Link>
                  <Link
                    href={`/admin/weeks/${w.id}`}
                    className={buttonVariants({
                      variant: 'outline',
                      size: 'sm',
                    })}
                  >
                    Open
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3 pt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Danger zone
        </h2>
        <div className="rounded border border-destructive/40 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium">Delete this assignment</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Permanently removes the assignment, all weeks, sessions,
                prescribed exercises, and logged sets. No undo.
              </p>
            </div>
            <Link
              href={`/admin/assignments/${a.id}/delete`}
              className={buttonVariants({
                variant: 'destructive',
                size: 'sm',
              })}
            >
              Delete assignment
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
