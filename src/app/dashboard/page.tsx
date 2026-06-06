import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { logout } from './actions'
import { Button, buttonVariants } from '@/components/ui/button'
import { WioLogo } from '@/components/wio-logo'

export default async function DashboardPage() {
  const me = await requireUser()

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="mb-8 flex items-center gap-4">
        <WioLogo variant="mark" size={48} />
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {me.email} <span className="text-brand">·</span> {me.role}
          </p>
        </div>
      </div>

      {me.role === 'admin' && (
        <div className="mb-6">
          <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
            Open admin
          </Link>
        </div>
      )}

      <form action={logout}>
        <Button type="submit" variant="ghost">
          Log out
        </Button>
      </form>
    </main>
  )
}
