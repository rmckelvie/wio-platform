'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

function parseDecimal(v: FormDataEntryValue | null): number | null {
  const s = (v ?? '').toString().trim()
  if (!s) return null
  const n = Number.parseFloat(s.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseEnergy(v: FormDataEntryValue | null): number | null {
  const s = (v ?? '').toString().trim()
  if (!s) return null
  const n = Number.parseInt(s, 10)
  if (!Number.isFinite(n)) return null
  if (n < 1 || n > 5) return null
  return n
}

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = (v ?? '').toString().trim()
  return s.length === 0 ? null : s
}

/**
 * Save / overwrite today's metrics for the current user. RLS enforces
 * client_id = auth.uid() so admins can't accidentally write through
 * this path; they use the admin panel if needed.
 */
export async function saveMetric(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const measuredOn =
    (formData.get('measured_on') ?? '').toString().trim() ||
    new Date().toISOString().slice(0, 10)

  const weight_kg = parseDecimal(formData.get('weight_kg'))
  const sleep_hours = parseDecimal(formData.get('sleep_hours'))
  const energy = parseEnergy(formData.get('energy'))
  const notes = emptyToNull(formData.get('notes'))

  await supabase
    .from('client_metrics')
    .upsert(
      {
        client_id: user.id,
        measured_on: measuredOn,
        weight_kg,
        sleep_hours,
        energy,
        notes,
      },
      { onConflict: 'client_id,measured_on' },
    )

  revalidatePath('/dashboard')
}
