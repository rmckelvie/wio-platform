'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { releaseDateForWeek } from '@/lib/dates'

const MAX_WEEKS = 52

export async function createAssignment(clientId: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()

  const name = (formData.get('name') ?? '').toString().trim()
  const startDate = (formData.get('start_date') ?? '').toString().trim()
  const weeksRaw = (formData.get('weeks') ?? '').toString().trim()
  const weeks = Number.parseInt(weeksRaw, 10)
  const notes = (formData.get('notes') ?? '').toString().trim() || null

  const errors: string[] = []
  if (!name) errors.push('Name is required')
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate))
    errors.push('Start date must be YYYY-MM-DD')
  if (!Number.isFinite(weeks) || weeks < 1 || weeks > MAX_WEEKS)
    errors.push(`Weeks must be between 1 and ${MAX_WEEKS}`)

  if (errors.length) {
    const params = new URLSearchParams({ error: errors.join(', ') })
    redirect(`/admin/clients/${clientId}/assignments/new?${params}`)
  }

  // Create the assignment
  const { data: assignment, error: insertErr } = await supabase
    .from('client_assignments')
    .insert({
      client_id: clientId,
      name,
      start_date: startDate,
      weeks,
      notes,
    })
    .select('id')
    .single()

  if (insertErr || !assignment) {
    const params = new URLSearchParams({
      error: insertErr?.message ?? 'Failed to create assignment',
    })
    redirect(`/admin/clients/${clientId}/assignments/new?${params}`)
  }

  // Create one assignment_weeks row per week, with computed release_date
  const weekRows = Array.from({ length: weeks }, (_, i) => ({
    assignment_id: assignment.id,
    week_index: i + 1,
    release_date: releaseDateForWeek(startDate, i + 1),
  }))

  const { error: weeksErr } = await supabase
    .from('assignment_weeks')
    .insert(weekRows)

  if (weeksErr) {
    // best-effort: leave the assignment in place but surface the error
    const params = new URLSearchParams({
      error: `Assignment created but weeks failed: ${weeksErr.message}`,
    })
    redirect(`/admin/assignments/${assignment.id}?${params}`)
  }

  revalidatePath(`/admin/clients/${clientId}`)
  redirect(`/admin/assignments/${assignment.id}`)
}
