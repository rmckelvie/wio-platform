import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { inviteClient, setClientStatus } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'

interface ClientRow {
  id: string
  email: string
  display_name: string | null
  status: 'active' | 'archived' | null
}

const inputClass =
  'rounded border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; error?: string }>
}) {
  const { show, error } = await searchParams
  const showArchived = show === 'archived'

  const supabase = await createClient()
  const { data: profileRows } = await supabase
    .from('profiles')
    .select(
      `
      id,
      email,
      display_name,
      clients_admin ( status )
    `
    )
    .eq('role', 'client')
    .order('email', { ascending: true })

  type Joined = {
    id: string
    email: string
    display_name: string | null
    clients_admin:
      | { status: 'active' | 'archived' }
      | { status: 'active' | 'archived' }[]
      | null
  }

  const clients: ClientRow[] = ((profileRows ?? []) as Joined[]).map((p) => {
    const link = Array.isArray(p.clients_admin)
      ? p.clients_admin[0]
      : p.clients_admin
    return {
      id: p.id,
      email: p.email,
      display_name: p.display_name,
      status: link?.status ?? null,
    }
  })

  const filtered = clients.filter((c) =>
    showArchived ? c.status === 'archived' : c.status !== 'archived'
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Clients</h1>
      </div>

      {/* Invite form */}
      <section className="rounded border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Invite a new client</h2>
        <form action={inviteClient} className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              placeholder="client@example.com"
              className={inputClass}
            />
          </label>
          <label className="flex min-w-[200px] flex-1 flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Display name (optional)
            </span>
            <input
              name="display_name"
              type="text"
              placeholder="Ruari Souter"
              className={inputClass}
            />
          </label>
          <Button type="submit">Send invite</Button>
        </form>
        {error && (
          <p className="mt-3 text-sm text-destructive">
            {decodeURIComponent(error)}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Sends a magic link. The client signs in by clicking it.
        </p>
      </section>

      <div className="flex gap-2 text-sm">
        <Link
          href="/admin/clients"
          className={
            !showArchived
              ? 'rounded border border-border bg-secondary px-3 py-1 text-foreground'
              : 'rounded border border-border px-3 py-1 text-muted-foreground hover:bg-muted'
          }
        >
          Active
        </Link>
        <Link
          href="/admin/clients?show=archived"
          className={
            showArchived
              ? 'rounded border border-border bg-secondary px-3 py-1 text-foreground'
              : 'rounded border border-border px-3 py-1 text-muted-foreground hover:bg-muted'
          }
        >
          Archived
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchived
            ? 'No archived clients.'
            : 'No clients yet — invite one above.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <Link
                href={`/admin/clients/${c.id}`}
                className="min-w-0 flex-1 hover:opacity-80"
              >
                <div className="font-medium">{c.display_name || c.email}</div>
                {c.display_name && (
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                )}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/clients/${c.id}`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Open
                </Link>
                <form
                  action={async () => {
                    'use server'
                    await setClientStatus(
                      c.id,
                      c.status === 'archived' ? 'active' : 'archived'
                    )
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    {c.status === 'archived' ? 'Unarchive' : 'Archive'}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
