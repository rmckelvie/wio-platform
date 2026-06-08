'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { isSectionType, type SectionType } from '@/lib/sections'

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim()
  return s.length === 0 ? null : s
}

// =============================================================================
// SESSIONS
// =============================================================================

export async function createSession(weekId: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') ?? '').toString().trim()
  if (!name) {
    redirect(`/admin/weeks/${weekId}?error=Session+name+required`)
  }

  // Auto-assign session_index = max+1 within this week
  const { data: existing } = await supabase
    .from('assigned_sessions')
    .select('session_index')
    .eq('assignment_week_id', weekId)
    .order('session_index', { ascending: false })
    .limit(1)

  const nextIndex = (existing?.[0]?.session_index ?? 0) + 1

  const { error } = await supabase.from('assigned_sessions').insert({
    assignment_week_id: weekId,
    session_index: nextIndex,
    name,
  })

  if (error) {
    redirect(`/admin/weeks/${weekId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/admin/weeks/${weekId}`)
}

export async function updateSession(sessionId: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') ?? '').toString().trim()
  if (!name) {
    redirect(`/admin/sessions/${sessionId}/edit?error=Name+required`)
  }

  const { data: session } = await supabase
    .from('assigned_sessions')
    .select('assignment_week_id')
    .eq('id', sessionId)
    .single()

  const { error } = await supabase
    .from('assigned_sessions')
    .update({ name })
    .eq('id', sessionId)

  if (error) {
    redirect(
      `/admin/sessions/${sessionId}/edit?error=${encodeURIComponent(error.message)}`,
    )
  }

  if (session?.assignment_week_id) {
    revalidatePath(`/admin/weeks/${session.assignment_week_id}`)
    redirect(`/admin/weeks/${session.assignment_week_id}`)
  }
  redirect('/admin')
}

export async function deleteSession(sessionId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('assigned_sessions')
    .select('assignment_week_id')
    .eq('id', sessionId)
    .single()

  await supabase.from('assigned_sessions').delete().eq('id', sessionId)

  if (session?.assignment_week_id) {
    revalidatePath(`/admin/weeks/${session.assignment_week_id}`)
  }
}

// =============================================================================
// SECTIONS
// =============================================================================

export async function createSection(sessionId: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const type = (formData.get('section_type') ?? '').toString().trim()
  if (!isSectionType(type)) {
    redirect(`/admin/weeks/redirect?error=Invalid+section+type`)
  }
  const section_type = type as SectionType

  const { data: session } = await supabase
    .from('assigned_sessions')
    .select('assignment_week_id')
    .eq('id', sessionId)
    .single()

  // Auto-assign order_index = max+1 within this session
  const { data: existing } = await supabase
    .from('assigned_sections')
    .select('order_index')
    .eq('assigned_session_id', sessionId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order_index ?? 0) + 1

  const { error } = await supabase.from('assigned_sections').insert({
    assigned_session_id: sessionId,
    order_index: nextOrder,
    section_type,
  })

  const weekId = session?.assignment_week_id
  if (error) {
    redirect(
      `/admin/weeks/${weekId}?error=${encodeURIComponent(error.message)}`,
    )
  }

  if (weekId) revalidatePath(`/admin/weeks/${weekId}`)
}

export async function deleteSection(sectionId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: section } = await supabase
    .from('assigned_sections')
    .select('assigned_session_id, assigned_sessions!inner ( assignment_week_id )')
    .eq('id', sectionId)
    .single()

  await supabase.from('assigned_sections').delete().eq('id', sectionId)

  type Joined = {
    assigned_sessions:
      | { assignment_week_id: string }
      | { assignment_week_id: string }[]
      | null
  }
  const s = section as Joined | null
  const sessionParent = Array.isArray(s?.assigned_sessions)
    ? s?.assigned_sessions[0]
    : s?.assigned_sessions
  const weekId = sessionParent?.assignment_week_id

  if (weekId) revalidatePath(`/admin/weeks/${weekId}`)
}

// =============================================================================
// ASSIGNED EXERCISES (prescriptions)
// =============================================================================

export async function createAssignedExercise(
  sectionId: string,
  formData: FormData,
) {
  await requireAdmin()
  const supabase = await createClient()

  const exercise_id = (formData.get('exercise_id') ?? '').toString().trim()
  const prescribed_sets = emptyToNull(formData.get('prescribed_sets'))
  const prescribed_reps = emptyToNull(formData.get('prescribed_reps'))
  const notes = emptyToNull(formData.get('notes'))

  if (!exercise_id) {
    // Need the parent week to bounce back nicely
    const { data: section } = await supabase
      .from('assigned_sections')
      .select('assigned_sessions!inner ( assignment_week_id )')
      .eq('id', sectionId)
      .single()
    type Joined = {
      assigned_sessions:
        | { assignment_week_id: string }
        | { assignment_week_id: string }[]
        | null
    }
    const s = section as Joined | null
    const sessionParent = Array.isArray(s?.assigned_sessions)
      ? s?.assigned_sessions[0]
      : s?.assigned_sessions
    const weekId = sessionParent?.assignment_week_id ?? ''
    redirect(`/admin/weeks/${weekId}?error=Pick+an+exercise`)
  }

  // Auto-assign order_index = max+1
  const { data: existing } = await supabase
    .from('assigned_exercises')
    .select('order_index')
    .eq('assigned_section_id', sectionId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order_index ?? 0) + 1

  const { error } = await supabase.from('assigned_exercises').insert({
    assigned_section_id: sectionId,
    exercise_id,
    order_index: nextOrder,
    prescribed_sets,
    prescribed_reps,
    notes,
  })

  const { data: section } = await supabase
    .from('assigned_sections')
    .select('assigned_sessions!inner ( assignment_week_id )')
    .eq('id', sectionId)
    .single()
  type Joined = {
    assigned_sessions:
      | { assignment_week_id: string }
      | { assignment_week_id: string }[]
      | null
  }
  const s = section as Joined | null
  const sessionParent = Array.isArray(s?.assigned_sessions)
    ? s?.assigned_sessions[0]
    : s?.assigned_sessions
  const weekId = sessionParent?.assignment_week_id

  if (error) {
    redirect(
      `/admin/weeks/${weekId ?? ''}?error=${encodeURIComponent(error.message)}`,
    )
  }

  if (weekId) revalidatePath(`/admin/weeks/${weekId}`)
}

export async function updateAssignedExercise(
  id: string,
  formData: FormData,
) {
  await requireAdmin()
  const supabase = await createClient()

  const prescribed_sets = emptyToNull(formData.get('prescribed_sets'))
  const prescribed_reps = emptyToNull(formData.get('prescribed_reps'))
  const notes = emptyToNull(formData.get('notes'))

  // Look up week id for revalidate + redirect
  const { data: ae } = await supabase
    .from('assigned_exercises')
    .select(
      'assigned_sections!inner ( assigned_sessions!inner ( assignment_week_id ) )',
    )
    .eq('id', id)
    .single()

  type Joined = {
    assigned_sections:
      | {
          assigned_sessions:
            | { assignment_week_id: string }
            | { assignment_week_id: string }[]
            | null
        }
      | {
          assigned_sessions:
            | { assignment_week_id: string }
            | { assignment_week_id: string }[]
            | null
        }[]
      | null
  }
  const a = ae as Joined | null
  const sectionParent = Array.isArray(a?.assigned_sections)
    ? a?.assigned_sections[0]
    : a?.assigned_sections
  const sessionParent = Array.isArray(sectionParent?.assigned_sessions)
    ? sectionParent?.assigned_sessions[0]
    : sectionParent?.assigned_sessions
  const weekId = sessionParent?.assignment_week_id

  const { error } = await supabase
    .from('assigned_exercises')
    .update({ prescribed_sets, prescribed_reps, notes })
    .eq('id', id)

  if (error) {
    redirect(
      `/admin/assigned-exercises/${id}/edit?error=${encodeURIComponent(error.message)}`,
    )
  }

  if (weekId) {
    revalidatePath(`/admin/weeks/${weekId}`)
    redirect(`/admin/weeks/${weekId}`)
  }
  redirect('/admin')
}

export async function deleteAssignedExercise(id: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: ae } = await supabase
    .from('assigned_exercises')
    .select(
      'assigned_sections!inner ( assigned_sessions!inner ( assignment_week_id ) )',
    )
    .eq('id', id)
    .single()

  await supabase.from('assigned_exercises').delete().eq('id', id)

  type Joined = {
    assigned_sections:
      | {
          assigned_sessions:
            | { assignment_week_id: string }
            | { assignment_week_id: string }[]
            | null
        }
      | {
          assigned_sessions:
            | { assignment_week_id: string }
            | { assignment_week_id: string }[]
            | null
        }[]
      | null
  }
  const a = ae as Joined | null
  const sectionParent = Array.isArray(a?.assigned_sections)
    ? a?.assigned_sections[0]
    : a?.assigned_sections
  const sessionParent = Array.isArray(sectionParent?.assigned_sessions)
    ? sectionParent?.assigned_sessions[0]
    : sectionParent?.assigned_sessions
  const weekId = sessionParent?.assignment_week_id

  if (weekId) revalidatePath(`/admin/weeks/${weekId}`)
}
