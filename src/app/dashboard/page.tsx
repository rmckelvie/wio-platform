import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logout } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'
import { formatDate } from '@/lib/dates'

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
      <div className="mb-8 text-sm">{me.email}</div>

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
        <WioLogo variant="mark" size={48} />
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

      <form action={logout}>
        <Button type="submit" variant="ghost">
          Log out
        </Button>
      </form>
    </main>
  )
}
