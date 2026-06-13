import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button, buttonVariants } from '@/components/ui/button'
import { updateAssignment } from '../actions'

const inputClass =
  'rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30'

export default async function EditAssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const { data: a, error: fetchErr } = await supabase
    .from('client_assignments')
    .select('id, name, start_date, weeks, notes')
    .eq('id', id)
    .single()

  if (fetchErr || !a) notFound()

  const action = updateAssignment.bind(null, a.id)

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

      <h1 className="text-2xl font-semibold">Edit assignment</h1>

      <form action={action} className="flex max-w-xl flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={a.name}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Start date</span>
          <input
            name="start_date"
            type="date"
            required
            defaultValue={a.start_date}
            className={inputClass}
          />
          <span className="text-xs text-muted-foreground">
            Changing this shifts every week&apos;s release date.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Weeks</span>
          <input
            type="number"
            disabled
            defaultValue={a.weeks}
            className={`${inputClass} cursor-not-allowed opacity-60`}
          />
          <span className="text-xs text-muted-foreground">
            Block length is locked once created. If you need a different length,
            create a new assignment.
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={a.notes ?? ''}
            className={inputClass}
          />
        </label>

        {error && (
          <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
        )}

        <div>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  )
}
