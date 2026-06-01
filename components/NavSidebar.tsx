'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard',  label: 'Dashboard' },
  { href: '/quotes',     label: 'Quotes',   badge: 'New' },
  { href: '/clients',    label: 'Clients' },
  { href: '/leads',      label: 'Leads' },
  { href: '/projects',   label: 'Projects' },
  { href: '/expenses',   label: 'Expenses' },
  { href: '/reports',    label: 'Reports' },
]

export default function NavSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full z-40">
      <div className="p-6 border-b border-gray-700">
        <h1 className="font-bold text-lg text-white">Infinity Wrap</h1>
        <p className="text-orange-400 text-xs font-medium">Manager OS</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}>
              <span>{item.label}</span>
              {item.badge && !isActive && (
                <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{item.badge}</span>
              )}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-gray-700">
        <p className="text-gray-400 text-xs">Infinity Wrap Design</p>
        <p className="text-gray-500 text-xs">North Carolina</p>
      </div>
    </aside>
  )
}
