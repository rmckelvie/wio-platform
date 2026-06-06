import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Role = 'admin' | 'client'

export interface CurrentUser {
  id: string
  email: string
  role: Role
}

/**
 * Get the current user + their role from the profiles table.
 * Redirects to /login if not signed in.
 */
export async function requireUser(): Promise<CurrentUser> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email!,
    role: (profile?.role as Role) ?? 'client',
  }
}

/**
 * Require admin role. Redirects to /dashboard for clients, /login for unauthenticated.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const me = await requireUser()
  if (me.role !== 'admin') redirect('/dashboard')
  return me
}
