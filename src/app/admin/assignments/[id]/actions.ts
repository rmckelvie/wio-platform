'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { releaseDateForWeek } from '@/lib/dates'

type AssignmentStatus = 'active' | 'completed' | 'paused'

/**
 * Update assignment name / notes / start_date / status.
 * If start_date changes, all assignment_weeks rows have release_date recomputed.
 * `weeks` is NOT editable here — if a different length is needed, create a new assignment.
 */
export async function updateAssignment(id: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') ?? '').toString().trim()
  const startDate = (formData.get('start_date') ?? '').toString().trim()
  const notes = (formData.get('notes') ?? '').toString().trim() || null

  if (!name) {
    redirect(`/admin/assignments/${id}/edit?error=Name+required`)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    redirect(`/admin/assignments/${id}/edit?error=Bad+start+date`)
  }

  // Fetch existing to know whether start_date changed
  const { data: existing } = await supabase
    .from('client_assignments')
    .select('start_date, weeks')
    .eq('id', id)
    .single()

  const { error: updErr } = await supabase
    .from('client_assignments')
    .update({ name, start_date: startDate, notes })
    .eq('id', id)

  if (updErr) {
    redirect(
      `/admin/assignments/${id}/edit?error=${encodeURIComponent(updErr.message)}`
    )
  }

  // If start_date changed, recompute all assignment_weeks.release_date
  if (existing && existing.start_date !== startDate) {
    const { data: weekRows } = await supabase
      .from('assignment_weeks')
      .select('id, week_index')
      .eq('assignment_id', id)

    for (const w of weekRows ?? []) {
      await supabase
        .from('assignment_weeks')
        .update({ release_date: releaseDateForWeek(startDate, w.week_index) })
        .eq('id', w.id)
    }
  }

  revalidatePath(`/admin/assignments/${id}`)
  redirect(`/admin/assignments/${id}`)
}

export async function setAssignmentStatus(
  id: string,
  status: AssignmentStatus
) {
  await requireAdmin()
  const supabase = await createClient()
  await supabase.from('client_assignments').update({ status }).eq('id', id)
  revalidatePath(`/admin/assignments/${id}`)
}

/**
 * Hard-delete an assignment. The ON DELETE CASCADE chain takes
 * assignment_weeks → assigned_sessions → assigned_sections →
 * assigned_exercises → exercise_logs with it. The shared exercise
 * library and the client profile are untouched.
 *
 * Trainer must type the assignment name to confirm.
 */
export async function deleteAssignment(id: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const { data: a, error: fetchErr } = await supabase
    .from('client_assignments')
    .select('id, name, client_id')
    .eq('id', id)
    .single()

  if (fetchErr || !a) {
    redirect(`/admin/clients?error=Assignment+not+found`)
  }

  const confirmation = (formData.get('confirm_name') ?? '')
    .toString()
    .trim()
    .toLowerCase()
  if (confirmation !== a.name.toLowerCase()) {
    redirect(
      `/admin/assignments/${id}/delete?error=${encodeURIComponent(
        'Assignment name did not match',
      )}`,
    )
  }

  const { error } = await supabase
    .from('client_assignments')
    .delete()
    .eq('id', id)

  if (error) {
    redirect(
      `/admin/assignments/${id}/delete?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath(`/admin/clients/${a.client_id}`)
  redirect(`/admin/clients/${a.client_id}`)
}
