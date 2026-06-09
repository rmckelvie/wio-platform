'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { parseMaxSets } from '@/lib/prescription'

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
 * Enforces the prescribed-sets cap server-side: if prescribed_sets parses to
 * a hard number (or the high end of a range), the action refuses to insert
 * once that many sets exist. Client UI hides the form too, but this is the
 * real gate.
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

  // Fetch prescribed sets + the already-logged sets in one round trip
  const { data: ae } = await supabase
    .from('assigned_exercises')
    .select('prescribed_sets, exercise_logs ( set_number )')
    .eq('id', assignedExerciseId)
    .single()

  type Joined = {
    prescribed_sets: string | null
    exercise_logs: { set_number: number }[] | null
  }
  const aeRow = ae as Joined | null
  const existingLogs = aeRow?.exercise_logs ?? []
  const maxSets = parseMaxSets(aeRow?.prescribed_sets ?? null)

  if (maxSets !== null && existingLogs.length >= maxSets) {
    redirect(
      `/sessions/${sessionId}?error=All+prescribed+sets+already+logged`,
    )
  }

  const nextSet =
    existingLogs.reduce((m, r) => Math.max(m, r.set_number), 0) + 1

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
