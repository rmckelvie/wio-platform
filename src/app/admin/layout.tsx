import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { WioLogo } from '@/components/wio-logo'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = await requireAdmin()

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-sidebar">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <WioLogo variant="mark" size={28} />
              <span className="hidden sm:inline">WIO admin</span>
            </Link>
            <Link
              href="/admin/exercises"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Exercises
            </Link>
            <Link
              href="/admin/clients"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Clients
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">{me.email}</div>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  )
}
