import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { updateSession } from '@/app/admin/weeks/[id]/actions'

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default async function EditSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: session, error: fetchErr } = await supabase
    .from('assigned_sessions')
    .select('id, name, session_index, assignment_week_id')
    .eq('id', id)
    .single()

  if (fetchErr || !session) notFound()

  const action = updateSession.bind(null, session.id)

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/admin/weeks/${session.assignment_week_id}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← Week
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">Rename session</h1>

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={session.name}
            className={inputClass}
          />
          <span className="text-xs text-muted-foreground">
            Session {session.session_index}.
          </span>
        </label>

        {error && (
          <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit">Save</Button>
          <Link
            href={`/admin/weeks/${session.assignment_week_id}`}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
