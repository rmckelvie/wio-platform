import Link from 'next/link'
import { signup } from './actions'
import { Button } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-10 px-6">
      <div className="flex flex-col items-center gap-4">
        <Link href="/" aria-label="Home">
          <WioLogo variant="wordmark" size={220} priority />
        </Link>
        <div className="h-px w-16 bg-brand" />
      </div>

      <div>
        <h1 className="mb-6 text-center text-xl font-medium">Sign up</h1>

        <form action={signup} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Email
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Password
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded border border-input bg-card px-3 py-2 outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            />
            <span className="text-xs text-muted-foreground">At least 8 characters.</span>
          </label>

          {error && (
            <p className="text-sm text-destructive">{decodeURIComponent(error)}</p>
          )}

          <Button type="submit" size="lg" className="mt-2">
            Create account
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-brand underline-offset-4 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
