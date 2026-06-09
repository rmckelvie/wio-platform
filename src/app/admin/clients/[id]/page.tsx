import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { buttonVariants } from '@/components/ui/button'
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

  return (
    <div className="space-y-8">
      <div className="text-sm">
        <Link
          href="/admin/clients"
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Clients
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
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
                  <div className="flex shrink-0 items-center gap-3">
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
                  </div>
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
