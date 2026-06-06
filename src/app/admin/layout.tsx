import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const me = await requireAdmin()

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-6 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-sm font-semibold">
              WIO admin
            </Link>
            <Link
              href="/admin/exercises"
              className="text-sm text-gray-700 hover:text-black"
            >
              Exercises
            </Link>
            <Link
              href="/admin/clients"
              className="text-sm text-gray-700 hover:text-black"
            >
              Clients
            </Link>
          </div>
          <div className="text-xs text-gray-500">{me.email}</div>
        </nav>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-8">{children}</div>
    </div>
  )
}
