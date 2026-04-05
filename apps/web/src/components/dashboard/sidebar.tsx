'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/chat', label: 'Chat' },
  { href: '/dashboard/keys', label: 'API Keys' },
  { href: '/dashboard/providers', label: 'Providers' },
  { href: '/dashboard/logs', label: 'Logs' },
  { href: '/dashboard/routing', label: 'Routing' },
  { href: '/dashboard/aliases', label: 'Aliases' },
  { href: '/dashboard/settings', label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="w-60 border-r border-neutral-800 bg-neutral-950 p-4 flex flex-col">
      <Link href="/" className="text-lg font-bold tracking-tight mb-8">EdgeRouteAI</Link>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition ${isActive ? 'bg-neutral-800 text-white font-medium' : 'text-neutral-400 hover:bg-neutral-900 hover:text-white'}`}>
              {item.label}
            </Link>
          )
        })}
      </nav>
      {user && (
        <div className="border-t border-neutral-800 pt-4 mt-4">
          <p className="text-xs text-neutral-500 truncate px-3">{user.email}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-md px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white transition text-left"
          >
            Sign Out
          </button>
        </div>
      )}
    </aside>
  )
}
