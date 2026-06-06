import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { setArchived } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'

interface Exercise {
  id: string
  name: string
  video_url: string | null
  default_notes: string | null
  archived: boolean
}

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>
}) {
  const { show } = await searchParams
  const showArchived = show === 'archived'

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, video_url, default_notes, archived')
    .eq('archived', showArchived)
    .order('name', { ascending: true })

  const exercises = (data ?? []) as Exercise[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exercise library</h1>
        <Link href="/admin/exercises/new" className={buttonVariants()}>
          New exercise
        </Link>
      </div>

      <div className="flex gap-2 text-sm">
        <Link
          href="/admin/exercises"
          className={
            !showArchived
              ? 'rounded border border-border bg-secondary px-3 py-1 text-foreground'
              : 'rounded border border-border px-3 py-1 text-muted-foreground hover:bg-muted'
          }
        >
          Active
        </Link>
        <Link
          href="/admin/exercises?show=archived"
          className={
            showArchived
              ? 'rounded border border-border bg-secondary px-3 py-1 text-foreground'
              : 'rounded border border-border px-3 py-1 text-muted-foreground hover:bg-muted'
          }
        >
          Archived
        </Link>
      </div>

      {error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {showArchived
            ? 'No archived exercises.'
            : 'No exercises yet — add your first one.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border">
          {exercises.map((ex) => (
            <li
              key={ex.id}
              className="flex items-center justify-between gap-4 p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{ex.name}</div>
                {ex.video_url && (
                  <a
                    href={ex.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-xs text-brand underline-offset-4 hover:underline"
                  >
                    {ex.video_url}
                  </a>
                )}
                {ex.default_notes && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {ex.default_notes}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/admin/exercises/${ex.id}/edit`}
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  Edit
                </Link>
                <form
                  action={async () => {
                    'use server'
                    await setArchived(ex.id, !ex.archived)
                  }}
                >
                  <Button type="submit" variant="ghost" size="sm">
                    {ex.archived ? 'Unarchive' : 'Archive'}
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
