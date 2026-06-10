'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth'
import { isSectionType, type SectionType } from '@/lib/sections'

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

  const { error } = await supabase.from('exercises').insert({
    name,
    video_url: emptyToNull(formData.get('video_url')),
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

  const { error } = await supabase
    .from('exercises')
    .update({
      name,
      video_url: emptyToNull(formData.get('video_url')),
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

export async function setArchived(id: string, archived: boolean) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('exercises').update({ archived }).eq('id', id)
  revalidatePath('/admin/exercises')
}
