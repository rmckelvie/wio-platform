import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { createAssignment } from '../actions'

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default async function NewAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id: clientId } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, display_name, role')
    .eq('id', clientId)
    .single()

  if (!profile || profile.role !== 'client') notFound()

  const action = createAssignment.bind(null, clientId)
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link
          href={`/admin/clients/${clientId}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          ← {profile.display_name || profile.email}
        </Link>
      </div>

      <h1 className="text-2xl font-semibold">New assignment</h1>

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            type="text"
            required
            placeholder="e.g. Off-season block 1"
            className={inputClass}
          />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Start date</span>
            <input
              name="start_date"
              type="date"
              required
              defaultValue={today}
              className={inputClass}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Weeks</span>
            <input
              name="weeks"
              type="number"
              required
              min={1}
              max={52}
              defaultValue={6}
              className={inputClass}
            />
            <span className="text-xs text-muted-foreground">
              How long the block runs. Week 1 unlocks on the start date; each
              subsequent week unlocks 7 days later.
            </span>
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            className={inputClass}
            placeholder="Goals, constraints, anything you want to keep alongside the programme."
          />
        </label>

        {error && (
          <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
        )}

        <div>
          <Button type="submit">Create assignment</Button>
        </div>
      </form>
    </div>
  )
}
