import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { deleteAssignment } from '../actions'
import { formatDate, addDays } from '@/lib/dates'

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-destructive focus:ring-2 focus:ring-destructive/30'

interface AssignmentRow {
  id: string
  name: string
  start_date: string
  weeks: number
  client_id: string
  profiles: { email: string; display_name: string | null } | null
}

export default async function DeleteAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()

  const { data, error: fetchErr } = await supabase
    .from('client_assignments')
    .select(
      `
      id, name, start_date, weeks, client_id,
      profiles!inner ( email, display_name )
    `,
    )
    .eq('id', id)
    .single()

  if (fetchErr || !data) notFound()

  const a = data as unknown as AssignmentRow
  const clientName = a.profiles?.display_name || a.profiles?.email || 'client'
  const endDate = addDays(a.start_date, a.weeks * 7 - 1)

  // Count sessions and logged sets that will go with it
  const { count: sessionCount } = await supabase
    .from('assigned_sessions')
    .select(
      'id, assignment_weeks!inner ( assignment_id )',
      { count: 'exact', head: true },
    )
    .eq('assignment_weeks.assignment_id', a.id)

  const action = deleteAssignment.bind(null, a.id)

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/admin/assignments/${a.id}`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          ← {a.name}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-destructive">
        Delete assignment
      </h1>

      <section className="rounded border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm">
          You are about to permanently delete{' '}
          <span className="font-medium">{a.name}</span> for{' '}
          <span className="font-medium">{clientName}</span>.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            The {a.weeks} weeks ({formatDate(a.start_date)} →{' '}
            {formatDate(endDate)}) are deleted.
          </li>
          <li>
            All {sessionCount ?? 0} session
            {sessionCount === 1 ? '' : 's'} — sections, prescribed exercises,
            and any logged sets underneath — are deleted.
          </li>
          <li>The client account and exercise library are not affected.</li>
        </ul>
        <p className="mt-3 text-sm font-medium text-destructive">
          This cannot be undone.
        </p>
      </section>

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Type the assignment name to confirm
          </span>
          <input
            name="confirm_name"
            type="text"
            required
            autoComplete="off"
            placeholder={a.name}
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
            Permanently delete assignment
          </Button>
          <Link
            href={`/admin/assignments/${a.id}`}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
