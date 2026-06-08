import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { setArchived } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  SECTION_TYPES,
  sectionLabel,
  isSectionType,
  type SectionType,
} from '@/lib/sections'

interface Exercise {
  id: string
  name: string
  video_url: string | null
  default_notes: string | null
  archived: boolean
  section_types: SectionType[] | null
}

export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; tag?: string }>
}) {
  const { show, tag } = await searchParams
  const showArchived = show === 'archived'
  const tagFilter = tag && isSectionType(tag) ? (tag as SectionType) : null

  const supabase = await createClient()
  let query = supabase
    .from('exercises')
    .select('id, name, video_url, default_notes, archived, section_types')
    .eq('archived', showArchived)
    .order('name', { ascending: true })

  if (tagFilter) {
    query = query.contains('section_types', [tagFilter])
  }

  const { data, error } = await query

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

      {/* Category filter row */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Link
          href={showArchived ? '/admin/exercises?show=archived' : '/admin/exercises'}
          className={
            !tagFilter
              ? 'rounded-full border border-brand bg-brand/15 px-2.5 py-0.5 text-brand'
              : 'rounded-full border border-border px-2.5 py-0.5 text-muted-foreground hover:border-foreground hover:text-foreground'
          }
        >
          All
        </Link>
        {SECTION_TYPES.map((t) => {
          const params = new URLSearchParams()
          if (showArchived) params.set('show', 'archived')
          params.set('tag', t)
          return (
            <Link
              key={t}
              href={`/admin/exercises?${params}`}
              className={
                tagFilter === t
                  ? 'rounded-full border border-brand bg-brand/15 px-2.5 py-0.5 text-brand'
                  : 'rounded-full border border-border px-2.5 py-0.5 text-muted-foreground hover:border-foreground hover:text-foreground'
              }
            >
              {sectionLabel(t)}
            </Link>
          )
        })}
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
            : tagFilter
              ? `No exercises tagged ${sectionLabel(tagFilter)}.`
              : 'No exercises yet — add your first one.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded border border-border">
          {exercises.map((ex) => {
            const tags = ex.section_types ?? []
            return (
              <li
                key={ex.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{ex.name}</span>
                    {tags.length === 0 && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        Untagged
                      </span>
                    )}
                  </div>
                  {tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground"
                        >
                          {sectionLabel(t)}
                        </span>
                      ))}
                    </div>
                  )}
                  {ex.video_url && (
                    <a
                      href={ex.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-xs text-brand underline-offset-4 hover:underline"
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
            )
          })}
        </ul>
      )}
    </div>
  )
}
