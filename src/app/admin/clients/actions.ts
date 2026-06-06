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
  const redirectTo = origin ? `${origin}/auth/callback?next=/dashboard` : undefined

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
