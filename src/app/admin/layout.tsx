import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { WioLogo } from '@/components/wio-logo'
import { AdminNavLink } from '@/components/admin-nav-link'

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
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-80"
            >
              <WioLogo variant="mark" size={84} />
              <span className="hidden sm:inline">WIO admin</span>
            </Link>
            <div className="flex items-center gap-1">
              <AdminNavLink href="/admin/exercises">Exercises</AdminNavLink>
              <AdminNavLink href="/admin/clients">Clients</AdminNavLink>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">{me.email}</div>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  )
}
