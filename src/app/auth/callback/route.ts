import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Handles the redirect from a Supabase magic link / invite link.
 * Exchanges the one-time code in the URL for a session cookie,
 * then sends the user on to ?next= (or /dashboard by default).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // No code or exchange failed → send to login with a hint
  return NextResponse.redirect(`${origin}/login?error=invalid_or_expired_link`)
}
