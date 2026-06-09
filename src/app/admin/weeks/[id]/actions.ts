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

function parsePositiveInt(v: FormDataEntryValue | null): number | null {
  const s = (v ?? '').toString().trim()
  if (s.length === 0) return null
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
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
  const rest_seconds = parsePositiveInt(formData.get('rest_seconds'))
  const work_interval_seconds = parsePositiveInt(
    formData.get('work_interval_seconds'),
  )

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
    rest_seconds,
    work_interval_seconds,
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

  const rest_seconds = parsePositiveInt(formData.get('rest_seconds'))
  const work_interval_seconds = parsePositiveInt(
    formData.get('work_interval_seconds'),
  )

  const { error } = await supabase
    .from('assigned_exercises')
    .update({
      prescribed_sets,
      prescribed_reps,
      notes,
      rest_seconds,
      work_interval_seconds,
    })
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

// =============================================================================
// REORDERING — swap with the previous/next sibling
// =============================================================================

type Direction = 'up' | 'down'

async function swapOrder<T extends { id: string }>(
  rows: T[],
  currentIdx: number,
  siblingIdx: number,
  table: 'assigned_sessions' | 'assigned_sections' | 'assigned_exercises',
  field: 'session_index' | 'order_index',
  currentVal: number,
  siblingVal: number,
) {
  const supabase = await createClient()
  // Two updates; UNIQUE constraints were dropped in 20260608010000
  // so this is safe even with the temporary equal values during the race.
  await supabase
    .from(table)
    .update({ [field]: siblingVal })
    .eq('id', rows[currentIdx].id)
  await supabase
    .from(table)
    .update({ [field]: currentVal })
    .eq('id', rows[siblingIdx].id)
}

export async function moveSession(sessionId: string, direction: Direction) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('assigned_sessions')
    .select('assignment_week_id, session_index')
    .eq('id', sessionId)
    .single()

  if (!session) return
  const weekId = session.assignment_week_id

  const { data: siblings } = await supabase
    .from('assigned_sessions')
    .select('id, session_index')
    .eq('assignment_week_id', weekId)
    .order('session_index', { ascending: true })

  const list = siblings ?? []
  const idx = list.findIndex((r) => r.id === sessionId)
  if (idx === -1) return
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= list.length) return

  await swapOrder(
    list,
    idx,
    target,
    'assigned_sessions',
    'session_index',
    list[idx].session_index,
    list[target].session_index,
  )

  revalidatePath(`/admin/weeks/${weekId}`)
}

export async function moveSection(sectionId: string, direction: Direction) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: section } = await supabase
    .from('assigned_sections')
    .select(
      'assigned_session_id, order_index, assigned_sessions!inner ( assignment_week_id )',
    )
    .eq('id', sectionId)
    .single()

  if (!section) return
  type Joined = {
    assigned_session_id: string
    order_index: number
    assigned_sessions:
      | { assignment_week_id: string }
      | { assignment_week_id: string }[]
      | null
  }
  const s = section as unknown as Joined
  const sessionParent = Array.isArray(s.assigned_sessions)
    ? s.assigned_sessions[0]
    : s.assigned_sessions
  const weekId = sessionParent?.assignment_week_id

  const { data: siblings } = await supabase
    .from('assigned_sections')
    .select('id, order_index')
    .eq('assigned_session_id', s.assigned_session_id)
    .order('order_index', { ascending: true })

  const list = siblings ?? []
  const idx = list.findIndex((r) => r.id === sectionId)
  if (idx === -1) return
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= list.length) return

  await swapOrder(
    list,
    idx,
    target,
    'assigned_sections',
    'order_index',
    list[idx].order_index,
    list[target].order_index,
  )

  if (weekId) revalidatePath(`/admin/weeks/${weekId}`)
}

export async function moveAssignedExercise(
  exerciseId: string,
  direction: Direction,
) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: ae } = await supabase
    .from('assigned_exercises')
    .select(
      'assigned_section_id, order_index, assigned_sections!inner ( assigned_sessions!inner ( assignment_week_id ) )',
    )
    .eq('id', exerciseId)
    .single()

  if (!ae) return
  type Joined = {
    assigned_section_id: string
    order_index: number
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
  const a = ae as unknown as Joined
  const sectionParent = Array.isArray(a.assigned_sections)
    ? a.assigned_sections[0]
    : a.assigned_sections
  const sessionParent = Array.isArray(sectionParent?.assigned_sessions)
    ? sectionParent?.assigned_sessions[0]
    : sectionParent?.assigned_sessions
  const weekId = sessionParent?.assignment_week_id

  const { data: siblings } = await supabase
    .from('assigned_exercises')
    .select('id, order_index')
    .eq('assigned_section_id', a.assigned_section_id)
    .order('order_index', { ascending: true })

  const list = siblings ?? []
  const idx = list.findIndex((r) => r.id === exerciseId)
  if (idx === -1) return
  const target = direction === 'up' ? idx - 1 : idx + 1
  if (target < 0 || target >= list.length) return

  await swapOrder(
    list,
    idx,
    target,
    'assigned_exercises',
    'order_index',
    list[idx].order_index,
    list[target].order_index,
  )

  if (weekId) revalidatePath(`/admin/weeks/${weekId}`)
}

// =============================================================================
// COPY WEEK CONTENTS — append all sessions/sections/exercises from source week
// =============================================================================

export async function copyWeekContents(
  targetWeekId: string,
  formData: FormData,
) {
  await requireAdmin()
  const supabase = await createClient()

  const sourceWeekId = (formData.get('source_week_id') ?? '').toString().trim()
  if (!sourceWeekId) {
    redirect(`/admin/weeks/${targetWeekId}?error=Pick+a+source+week`)
  }
  if (sourceWeekId === targetWeekId) {
    redirect(`/admin/weeks/${targetWeekId}?error=Source+and+target+are+the+same`)
  }

  // Fetch source content (sessions → sections → exercises)
  const { data: source, error: srcErr } = await supabase
    .from('assignment_weeks')
    .select(
      `
      id,
      assigned_sessions (
        session_index, name,
        assigned_sections (
          order_index, section_type,
          assigned_exercises (
            order_index, exercise_id, prescribed_sets, prescribed_reps, notes
          )
        )
      )
    `,
    )
    .eq('id', sourceWeekId)
    .single()

  if (srcErr || !source) {
    redirect(
      `/admin/weeks/${targetWeekId}?error=${encodeURIComponent(
        srcErr?.message ?? 'Source week not found',
      )}`,
    )
  }

  type Ex = {
    order_index: number
    exercise_id: string
    prescribed_sets: string | null
    prescribed_reps: string | null
    notes: string | null
  }
  type Sec = {
    order_index: number
    section_type: SectionType
    assigned_exercises: Ex[]
  }
  type Ses = {
    session_index: number
    name: string
    assigned_sections: Sec[]
  }
  const sourceSessions = ((source as { assigned_sessions: Ses[] | null })
    .assigned_sessions ?? []) as Ses[]

  if (sourceSessions.length === 0) {
    redirect(
      `/admin/weeks/${targetWeekId}?error=Source+week+is+empty`,
    )
  }

  // Find current max session_index in the target so we append rather than collide
  const { data: existingSessions } = await supabase
    .from('assigned_sessions')
    .select('session_index')
    .eq('assignment_week_id', targetWeekId)
    .order('session_index', { ascending: false })
    .limit(1)
  const baseSessionIdx = existingSessions?.[0]?.session_index ?? 0

  // Insert sessions, then sections, then exercises in sequence
  for (let i = 0; i < sourceSessions.length; i++) {
    const ss = sourceSessions[i]
    const { data: newSession, error: insSesErr } = await supabase
      .from('assigned_sessions')
      .insert({
        assignment_week_id: targetWeekId,
        session_index: baseSessionIdx + i + 1,
        name: ss.name,
      })
      .select('id')
      .single()

    if (insSesErr || !newSession) {
      redirect(
        `/admin/weeks/${targetWeekId}?error=${encodeURIComponent(
          insSesErr?.message ?? 'Failed to copy session',
        )}`,
      )
    }

    const sections = ss.assigned_sections ?? []
    for (const sec of sections) {
      const { data: newSection, error: insSecErr } = await supabase
        .from('assigned_sections')
        .insert({
          assigned_session_id: newSession.id,
          order_index: sec.order_index,
          section_type: sec.section_type,
        })
        .select('id')
        .single()

      if (insSecErr || !newSection) {
        redirect(
          `/admin/weeks/${targetWeekId}?error=${encodeURIComponent(
            insSecErr?.message ?? 'Failed to copy section',
          )}`,
        )
      }

      const exercises = sec.assigned_exercises ?? []
      if (exercises.length > 0) {
        const rows = exercises.map((e) => ({
          assigned_section_id: newSection.id,
          order_index: e.order_index,
          exercise_id: e.exercise_id,
          prescribed_sets: e.prescribed_sets,
          prescribed_reps: e.prescribed_reps,
          notes: e.notes,
        }))
        const { error: insExErr } = await supabase
          .from('assigned_exercises')
          .insert(rows)

        if (insExErr) {
          redirect(
            `/admin/weeks/${targetWeekId}?error=${encodeURIComponent(insExErr.message)}`,
          )
        }
      }
    }
  }

  revalidatePath(`/admin/weeks/${targetWeekId}`)
  redirect(`/admin/weeks/${targetWeekId}`)
}

/**
 * Populate every later week of the same assignment with a copy of this week's
 * content. Only weeks that are currently empty (no sessions) are touched —
 * non-empty weeks are skipped to avoid clobbering work. Designed for the
 * common "author Week 1, propagate to weeks 2..N, then progress sets/reps"
 * workflow.
 */
export async function propagateToLaterWeeks(sourceWeekId: string) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: source } = await supabase
    .from('assignment_weeks')
    .select('id, assignment_id, week_index')
    .eq('id', sourceWeekId)
    .single()

  if (!source) {
    redirect(`/admin/weeks/${sourceWeekId}?error=Source+week+not+found`)
  }

  const { data: srcContent } = await supabase
    .from('assignment_weeks')
    .select(
      `
      id,
      assigned_sessions (
        session_index, name,
        assigned_sections (
          order_index, section_type,
          assigned_exercises (
            order_index, exercise_id, prescribed_sets, prescribed_reps, notes
          )
        )
      )
    `,
    )
    .eq('id', sourceWeekId)
    .single()

  type Ex = {
    order_index: number
    exercise_id: string
    prescribed_sets: string | null
    prescribed_reps: string | null
    notes: string | null
  }
  type Sec = {
    order_index: number
    section_type: SectionType
    assigned_exercises: Ex[]
  }
  type Ses = {
    session_index: number
    name: string
    assigned_sections: Sec[]
  }

  const sourceSessions = ((srcContent as { assigned_sessions: Ses[] | null })
    ?.assigned_sessions ?? []) as Ses[]

  if (sourceSessions.length === 0) {
    redirect(`/admin/weeks/${sourceWeekId}?error=This+week+has+no+content+to+propagate`)
  }

  // Sort sessions so the inserted copies keep the same order
  sourceSessions.sort((a, b) => a.session_index - b.session_index)

  const { data: laterWeeks } = await supabase
    .from('assignment_weeks')
    .select('id, week_index, assigned_sessions ( id )')
    .eq('assignment_id', source.assignment_id)
    .gt('week_index', source.week_index)
    .order('week_index', { ascending: true })

  let populated = 0
  let skipped = 0

  for (const wk of laterWeeks ?? []) {
    const hasContent = (wk.assigned_sessions ?? []).length > 0
    if (hasContent) {
      skipped++
      continue
    }

    for (let i = 0; i < sourceSessions.length; i++) {
      const ss = sourceSessions[i]
      const { data: newSession } = await supabase
        .from('assigned_sessions')
        .insert({
          assignment_week_id: wk.id,
          session_index: i + 1,
          name: ss.name,
        })
        .select('id')
        .single()

      if (!newSession) continue

      for (const sec of ss.assigned_sections ?? []) {
        const { data: newSection } = await supabase
          .from('assigned_sections')
          .insert({
            assigned_session_id: newSession.id,
            order_index: sec.order_index,
            section_type: sec.section_type,
          })
          .select('id')
          .single()

        if (!newSection) continue

        const rows = (sec.assigned_exercises ?? []).map((e) => ({
          assigned_section_id: newSection.id,
          order_index: e.order_index,
          exercise_id: e.exercise_id,
          prescribed_sets: e.prescribed_sets,
          prescribed_reps: e.prescribed_reps,
          notes: e.notes,
        }))
        if (rows.length > 0) {
          await supabase.from('assigned_exercises').insert(rows)
        }
      }
    }
    populated++
  }

  const parts: string[] = []
  parts.push(`Populated ${populated} week${populated === 1 ? '' : 's'}`)
  if (skipped > 0) {
    parts.push(`skipped ${skipped} non-empty week${skipped === 1 ? '' : 's'}`)
  }

  revalidatePath(`/admin/weeks/${sourceWeekId}`)
  redirect(
    `/admin/weeks/${sourceWeekId}?msg=${encodeURIComponent(parts.join('; '))}`,
  )
}
