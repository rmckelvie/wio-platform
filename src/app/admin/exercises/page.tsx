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
  searchParams: Promise<{ show?: string; tag?: string; q?: string }>
}) {
  const { show, tag, q } = await searchParams
  const showArchived = show === 'archived'
  const tagFilter = tag && isSectionType(tag) ? (tag as SectionType) : null
  const search = (q ?? '').trim()

  const supabase = await createClient()
  let query = supabase
    .from('exercises')
    .select('id, name, video_url, default_notes, archived, section_types')
    .eq('archived', showArchived)
    .order('name', { ascending: true })

  if (tagFilter) {
    query = query.contains('section_types', [tagFilter])
  }
  if (search.length > 0) {
    // ilike = case-insensitive LIKE; % wildcards on either side for substring match.
    // Escape user input's % and _ so they're treated as literal characters,
    // not wildcards.
    const escaped = search.replace(/[%_]/g, (c) => `\\${c}`)
    query = query.ilike('name', `%${escaped}%`)
  }

  const { data, error } = await query

  const exercises = (data ?? []) as Exercise[]

  // Build href helpers that preserve the other filters
  const buildHref = (overrides: {
    show?: string | null
    tag?: string | null
    q?: string | null
  }) => {
    const params = new URLSearchParams()
    const finalShow =
      'show' in overrides ? overrides.show : showArchived ? 'archived' : null
    const finalTag = 'tag' in overrides ? overrides.tag : tagFilter
    const finalQ = 'q' in overrides ? overrides.q : search || null
    if (finalShow) params.set('show', finalShow)
    if (finalTag) params.set('tag', finalTag)
    if (finalQ) params.set('q', finalQ)
    const qs = params.toString()
    return qs ? `/admin/exercises?${qs}` : '/admin/exercises'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Exercise library</h1>
        <Link href="/admin/exercises/new" className={buttonVariants()}>
          New exercise
        </Link>
      </div>

      {/* Search */}
      <form method="get" action="/admin/exercises" className="flex gap-2">
        {showArchived && <input type="hidden" name="show" value="archived" />}
        {tagFilter && <input type="hidden" name="tag" value={tagFilter} />}
        <input
          type="search"
          name="q"
          defaultValue={search}
          placeholder="Search exercises by name…"
          aria-label="Search exercises"
          className="flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {search && (
          <Link
            href={buildHref({ q: null })}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            Clear
          </Link>
        )}
      </form>

      <div className="flex gap-2 text-sm">
        <Link
          href={buildHref({ show: null })}
          className={
            !showArchived
              ? 'rounded border border-border bg-secondary px-3 py-1 text-foreground'
              : 'rounded border border-border px-3 py-1 text-muted-foreground hover:bg-muted'
          }
        >
          Active
        </Link>
        <Link
          href={buildHref({ show: 'archived' })}
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
          href={buildHref({ tag: null })}
          className={
            !tagFilter
              ? 'rounded-full border border-brand bg-brand/15 px-2.5 py-0.5 text-brand'
              : 'rounded-full border border-border px-2.5 py-0.5 text-muted-foreground hover:border-foreground hover:text-foreground'
          }
        >
          All
        </Link>
        {SECTION_TYPES.map((t) => (
          <Link
            key={t}
            href={buildHref({ tag: t })}
            className={
              tagFilter === t
                ? 'rounded-full border border-brand bg-brand/15 px-2.5 py-0.5 text-brand'
                : 'rounded-full border border-border px-2.5 py-0.5 text-muted-foreground hover:border-foreground hover:text-foreground'
            }
          >
            {sectionLabel(t)}
          </Link>
        ))}
      </div>

      {(search || tagFilter) && (
        <p className="text-xs text-muted-foreground">
          {exercises.length} result{exercises.length === 1 ? '' : 's'}
          {search && (
            <>
              {' '}
              matching <span className="text-foreground">“{search}”</span>
            </>
          )}
          {tagFilter && (
            <>
              {' '}
              tagged{' '}
              <span className="text-foreground">{sectionLabel(tagFilter)}</span>
            </>
          )}
        </p>
      )}

      {error && (
        <p className="rounded border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message}
        </p>
      )}

      {exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search
            ? `No matches for “${search}”${tagFilter ? ` tagged ${sectionLabel(tagFilter)}` : ''}.`
            : showArchived
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
