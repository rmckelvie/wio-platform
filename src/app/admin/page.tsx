import Link from 'next/link'

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <ul className="space-y-2 text-sm">
        <li>
          <Link href="/admin/exercises" className="underline">
            Exercise library
          </Link>{' '}
          — the shared list of movements you can prescribe.
        </li>
        <li>
          <Link href="/admin/clients" className="underline">
            Clients
          </Link>{' '}
          — manage clients, set display names, build programmes.
        </li>
      </ul>
    </div>
  )
}
