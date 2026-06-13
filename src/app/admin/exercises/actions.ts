'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { isSectionType, type SectionType } from '@/lib/sections'
import { checkYouTubeEmbed } from '@/lib/youtube'

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim()
  return s.length === 0 ? null : s
}

function parseSectionTypes(formData: FormData): SectionType[] {
  return formData
    .getAll('section_types')
    .map((v) => v.toString())
    .filter(isSectionType)
}

function parseSubcategory(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim()
  return s.length === 0 ? null : s
}

export async function createExercise(formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') ?? '').toString().trim()
  if (!name) redirect('/admin/exercises/new?error=name+required')

  const videoUrl = emptyToNull(formData.get('video_url'))
  const embedAllowed = videoUrl ? await checkYouTubeEmbed(videoUrl) : null

  const { error } = await supabase.from('exercises').insert({
    name,
    video_url: videoUrl,
    embed_allowed: embedAllowed,
    default_notes: emptyToNull(formData.get('default_notes')),
    section_types: parseSectionTypes(formData),
    subcategory: parseSubcategory(formData.get('subcategory')),
  })

  if (error) redirect(`/admin/exercises/new?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/exercises')
  redirect('/admin/exercises')
}

export async function updateExercise(id: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') ?? '').toString().trim()
  if (!name) redirect(`/admin/exercises/${id}/edit?error=name+required`)

  const videoUrl = emptyToNull(formData.get('video_url'))
  const embedAllowed = videoUrl ? await checkYouTubeEmbed(videoUrl) : null

  const { error } = await supabase
    .from('exercises')
    .update({
      name,
      video_url: videoUrl,
      embed_allowed: embedAllowed,
      default_notes: emptyToNull(formData.get('default_notes')),
      section_types: parseSectionTypes(formData),
      subcategory: parseSubcategory(formData.get('subcategory')),
    })
    .eq('id', id)

  if (error)
    redirect(`/admin/exercises/${id}/edit?error=${encodeURIComponent(error.message)}`)

  revalidatePath('/admin/exercises')
  redirect('/admin/exercises')
}

/**
 * Backfill / refresh the `embed_allowed` flag on every exercise that has
 * a video URL. Runs oEmbed checks in parallel (capped by Promise.all's
 * scheduler — fine for the size of a single-trainer library).
 *
 * Surfaces a count in the redirect query string so the admin sees what
 * happened without a separate page.
 */
export async function recheckAllEmbedFlags() {
  await requireAdmin()
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('exercises')
    .select('id, video_url')
    .not('video_url', 'is', null)

  if (error) {
    redirect(`/admin/exercises?error=${encodeURIComponent(error.message)}`)
  }

  const results = await Promise.all(
    (rows ?? []).map(async (row) => {
      const allowed = await checkYouTubeEmbed(row.video_url)
      const { error: updErr } = await supabase
        .from('exercises')
        .update({ embed_allowed: allowed })
        .eq('id', row.id)
      return { id: row.id, allowed, ok: !updErr }
    }),
  )

  const checked = results.length
  const blocked = results.filter((r) => r.allowed === false).length
  const unknown = results.filter((r) => r.allowed === null).length

  revalidatePath('/admin/exercises')
  redirect(
    `/admin/exercises?info=${encodeURIComponent(
      `Re-checked ${checked} video${checked === 1 ? '' : 's'}: ${blocked} blocked, ${unknown} unknown.`,
    )}`,
  )
}

export async function setArchived(id: string, archived: boolean) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('exercises').update({ archived }).eq('id', id)
  revalidatePath('/admin/exercises')
}
