import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { logout } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'

export default async function DashboardPage() {
  const me = await requireUser()

  // For clients, surface their assignments (or a "nothing yet" empty state).
  // Admins use this page as a launchpad to /admin.
  const supabase = await createClient()
  const { data: assignments } =
    me.role === 'client'
      ? await supabase
          .from('client_assignments')
          .select('id, name, status')
          .eq('client_id', me.id)
          .neq('status', 'completed')
          .order('start_date', { ascending: false })
      : { data: null }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <WioLogo variant="mark" size={48} />
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {me.email} <span className="text-brand">·</span> {me.role}
          </p>
        </div>
      </div>

      {me.role === 'admin' && (
        <div className="mb-6">
          <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
            Open admin
          </Link>
        </div>
      )}

      {me.role === 'client' && (
        <section className="mb-8 space-y-3">
          <h2 className="text-lg font-medium">Your programmes</h2>
          {!assignments || assignments.length === 0 ? (
            <div className="rounded border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Your trainer hasn&apos;t assigned a programme yet.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You&apos;ll see it here as soon as they do.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded border border-border">
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0 flex-1 font-medium">{a.name}</div>
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <form action={logout}>
        <Button type="submit" variant="ghost">
          Log out
        </Button>
      </form>
    </main>
  )
}
