'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AdminNavLink({
  href,
  children,
}: {
  href: string
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const active =
    pathname === href ||
    (href !== '/admin' && pathname.startsWith(`${href}/`))

  return (
    <Link
      href={href}
      className={
        active
          ? 'rounded-md bg-brand/15 px-2.5 py-1 text-sm text-brand transition-colors'
          : 'rounded-md px-2.5 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground'
      }
    >
      {children}
    </Link>
  )
}
