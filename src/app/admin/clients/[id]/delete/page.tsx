import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { deleteClient } from '../../actions'

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/30'

export default async function DeleteClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', id)
    .single()

  if (profileErr || !profile || profile.role !== 'client') notFound()

  const { count: assignmentCount } = await supabase
    .from('client_assignments')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', id)

  const action = deleteClient.bind(null, profile.id)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/clients/${profile.id}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ← {profile.display_name || profile.email}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-destructive">Delete client</h1>

      <section className="rounded border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm">
          You are about to permanently delete{' '}
          <span className="font-medium">
            {profile.display_name || profile.email}
          </span>
          .
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Their login account is removed from Supabase Auth.</li>
          <li>
            All {assignmentCount ?? 0} assignment
            {assignmentCount === 1 ? '' : 's'} are deleted, including every
            session, section, prescribed exercise, and logged set underneath.
          </li>
          <li>The shared exercise library is not affected.</li>
        </ul>
        <p className="mt-3 text-sm font-medium text-destructive">
          This cannot be undone.
        </p>
      </section>

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Type the client&apos;s email to confirm
          </span>
          <input
            name="confirm_email"
            type="text"
            required
            autoComplete="off"
            placeholder={profile.email}
            className={inputClass}
          />
          <span className="text-xs text-muted-foreground">
            Must match exactly. Case-insensitive.
          </span>
        </label>

        {error && (
          <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" variant="destructive">
            Permanently delete client
          </Button>
          <Link
            href={`/admin/clients/${profile.id}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
