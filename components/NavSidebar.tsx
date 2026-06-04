'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const NAV_ITEMS = [
  { href: '/dashboard',        label: 'Dashboard' },
  { href: '/followup',         label: '🔥 Follow-up',    badge: 'HOT' },
  { href: '/prospects',        label: '🎯 Prospects',    badge: 'NEW' },
  { href: '/leads',            label: 'Leads' },
  { href: '/quotes',           label: 'Quotes' },
  { href: '/invoices',         label: 'Invoices' },
  { href: '/projects',         label: 'Projects' },
  { href: '/expenses',         label: 'Expenses' },
  { href: '/clients',          label: 'Clients' },
  { href: '/reports',          label: 'Reports' },
]

const ADMIN_ITEMS = [
  { href: '/admin/pricing',    label: 'Pricing Rules' },
  { href: '/admin/settings',   label: '⚙️ Business Setup' },
]

export default function NavSidebar() {
  const pathname = usePathname()
  const router   = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.replace('/login')
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  const linkClass = (href: string) =>
    `flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive(href)
        ? 'bg-orange-500 text-white'
        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
    }`

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full z-40">
      <div className="p-6 border-b border-gray-700">
        <h1 className="font-black text-lg text-white tracking-tight">INFINITY WRAP</h1>
        <p className="text-orange-400 text-xs font-semibold mt-0.5">Manager OS</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <Link key={item.href} href={item.href} className={linkClass(item.href)}>
            <span>{item.label}</span>
            {item.badge && !isActive(item.href) && (
              <span className={`text-white text-xs px-1.5 py-0.5 rounded-full font-bold ${
                item.badge === 'HOT' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'
              }`}>{item.badge}</span>
            )}
          </Link>
        ))}

        <div className="pt-3 pb-1">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-4 mb-2">Admin</p>
          {ADMIN_ITEMS.map(item => (
            <Link key={item.href} href={item.href} className={linkClass(item.href)}>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-gray-700 space-y-2">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
          <span>🚪</span><span>Sign Out</span>
        </button>
        <p className="text-gray-500 text-xs font-medium">Infinity Wrap Design</p>
        <p className="text-gray-600 text-xs">North Carolina</p>
      </div>
    </aside>
  )
}
