import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { logout } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'

export default async function DashboardPage() {
  const me = await requireUser()

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-6 text-sm text-gray-600">
        Signed in as {me.email} ({me.role})
      </p>

      {me.role === 'admin' && (
        <div className="mb-6">
          <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
            Open admin
          </Link>
        </div>
      )}

      <form action={logout}>
        <Button type="submit" variant="outline">
          Log out
        </Button>
      </form>
    </main>
  )
}
