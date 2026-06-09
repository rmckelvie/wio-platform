'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function parseNumeric(v: FormDataEntryValue | null): number | null {
  const s = (v ?? '').toString().trim()
  if (s.length === 0) return null
  const n = Number.parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseInteger(v: FormDataEntryValue | null): number | null {
  const s = (v ?? '').toString().trim()
  if (s.length === 0) return null
  const n = Number.parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Log a new set against an assigned exercise. set_number is auto-assigned
 * (max+1) so the client just adds sets as they go.
 *
 * RLS enforces: only the owning client (release_date <= today) OR an admin
 * may insert.
 */
export async function logSet(
  assignedExerciseId: string,
  sessionId: string,
  formData: FormData,
) {
  const supabase = await createClient()

  const weight_kg = parseNumeric(formData.get('weight_kg'))
  const reps_done = parseInteger(formData.get('reps_done'))
  const rpe = parseNumeric(formData.get('rpe'))
  const notes = (formData.get('notes') ?? '').toString().trim() || null

  if (weight_kg === null && reps_done === null) {
    redirect(
      `/sessions/${sessionId}?error=Enter+at+least+a+weight+or+a+rep+count`,
    )
  }

  // Auto-assign set_number
  const { data: latest } = await supabase
    .from('exercise_logs')
    .select('set_number')
    .eq('assigned_exercise_id', assignedExerciseId)
    .order('set_number', { ascending: false })
    .limit(1)
  const nextSet = (latest?.[0]?.set_number ?? 0) + 1

  const { error } = await supabase.from('exercise_logs').insert({
    assigned_exercise_id: assignedExerciseId,
    set_number: nextSet,
    weight_kg,
    reps_done,
    rpe,
    notes,
  })

  if (error) {
    redirect(`/sessions/${sessionId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/sessions/${sessionId}`)
}

export async function deleteLog(logId: string, sessionId: string) {
  const supabase = await createClient()
  await supabase.from('exercise_logs').delete().eq('id', logId)
  revalidatePath(`/sessions/${sessionId}`)
}
