import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Server-only Supabase client that uses the service_role key.
 * Bypasses RLS entirely — use ONLY in server actions / route handlers,
 * and ONLY for operations the admin user is authorised to do.
 *
 * NEVER expose this client to client components or the browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL'
    )
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
