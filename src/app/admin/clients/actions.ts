'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { requireAdmin } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

function back(error?: string) {
  if (error) redirect(`/admin/clients?error=${encodeURIComponent(error)}`)
  redirect('/admin/clients')
}

export async function inviteClient(formData: FormData) {
  await requireAdmin()

  const email = (formData.get('email') ?? '').toString().trim().toLowerCase()
  const displayName = (formData.get('display_name') ?? '').toString().trim()

  if (!email) back('Email is required')

  const admin = createAdminClient()

  // origin of the current request → where Supabase should send the user back to
  const h = await headers()
  const origin = h.get('origin') ?? h.get('referer')?.replace(/\/[^/]*$/, '') ?? ''
  // /auth/confirm uses verifyOtp under the hood (server-side OTP flow used by invites)
  const redirectTo = origin ? `${origin}/auth/confirm?next=/dashboard` : undefined

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: displayName ? { display_name: displayName } : undefined,
    redirectTo,
  })

  if (error) back(`Invite failed: ${error.message}`)
  if (!data?.user) back('Invite did not return a user')

  // Make sure profile.display_name is set (the trigger only sets email + role)
  if (displayName) {
    await admin
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', data!.user!.id)
  }

  // Add to the trainer's roster (active by default)
  await admin
    .from('clients_admin')
    .upsert({ client_id: data!.user!.id, status: 'active' })

  revalidatePath('/admin/clients')
  redirect('/admin/clients')
}

export async function setClientStatus(
  clientId: string,
  status: 'active' | 'archived'
) {
  await requireAdmin()
  const supabase = await createClient()

  // upsert in case there's no clients_admin row yet (legacy clients)
  await supabase
    .from('clients_admin')
    .upsert({ client_id: clientId, status }, { onConflict: 'client_id' })

  revalidatePath('/admin/clients')
}

/**
 * Set or clear the client's display_name. RLS allows admin to update any
 * profile (profiles_admin_update policy).
 */
export async function updateClientDisplayName(
  clientId: string,
  formData: FormData,
) {
  await requireAdmin()
  const supabase = await createClient()

  const raw = (formData.get('display_name') ?? '').toString().trim()
  const next = raw.length === 0 ? null : raw

  await supabase
    .from('profiles')
    .update({ display_name: next })
    .eq('id', clientId)

  revalidatePath('/admin/clients')
  revalidatePath(`/admin/clients/${clientId}`)
}

/**
 * HARD DELETE a client and all their data.
 *
 * Calls supabase.auth.admin.deleteUser with shouldSoftDelete=false so the row
 * is fully removed from auth.users (not soft-deleted). Our schema's
 * ON DELETE CASCADE chain takes care of every dependent row:
 *
 *   auth.users
 *     └── profiles
 *           ├── clients_admin
 *           └── client_assignments
 *                 └── assignment_weeks
 *                       └── assigned_sessions
 *                             └── assigned_sections
 *                                   └── assigned_exercises
 *                                         └── exercise_logs
 *
 * The shared `exercises` library is untouched.
 *
 * Safeguards:
 *   - requireAdmin() blocks non-admins.
 *   - We refuse to delete a row whose role is NOT 'client' (so this can't
 *     be turned into a tool for nuking the other trainer's admin row).
 *   - Caller must pass the client's email as `confirm_email` to confirm.
 */
export async function deleteClient(clientId: string, formData: FormData) {
  await requireAdmin()
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('email, role')
    .eq('id', clientId)
    .single()

  if (fetchErr || !profile) {
    redirect(`/admin/clients?error=Client+not+found`)
  }

  if (profile.role !== 'client') {
    redirect(`/admin/clients?error=Refusing+to+delete+a+non-client+account`)
  }

  const confirmation = (formData.get('confirm_email') ?? '')
    .toString()
    .trim()
    .toLowerCase()
  if (confirmation !== profile.email.toLowerCase()) {
    redirect(
      `/admin/clients/${clientId}/delete?error=${encodeURIComponent(
        'Email confirmation did not match',
      )}`,
    )
  }

  const { error } = await admin.auth.admin.deleteUser(clientId, false)
  if (error) {
    redirect(
      `/admin/clients/${clientId}/delete?error=${encodeURIComponent(error.message)}`,
    )
  }

  revalidatePath('/admin/clients')
  redirect('/admin/clients')
}
