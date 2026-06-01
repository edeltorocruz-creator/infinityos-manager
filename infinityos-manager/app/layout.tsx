import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Link from 'next/link'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Infinity Wrap Manager OS',
  description: 'Operations Management System — Infinity Wrap Design',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen">
          <aside className="w-64 bg-gray-900 text-white flex flex-col fixed h-full">
            <div className="p-6 border-b border-gray-700">
              <h1 className="font-bold text-lg text-white">Infinity Wrap</h1>
              <p className="text-orange-400 text-xs font-medium">Manager OS</p>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/quotes" label="Quotes" badge="New" />
              <NavLink href="/clients" label="Clients" />
              <NavLink href="/leads" label="Leads" />
              <NavLink href="/projects" label="Projects" />
              <NavLink href="/expenses" label="Expenses" />
              <NavLink href="/reports" label="Reports" />
            </nav>
            <div className="p-4 border-t border-gray-700">
              <p className="text-gray-400 text-xs">Infinity Wrap Design</p>
              <p className="text-gray-500 text-xs">North Carolina</p>
            </div>
          </aside>
          <main className="flex-1 ml-64">{children}</main>
        </div>
      </body>
    </html>
  )
}

function NavLink({ href, label, badge }: { href: string; label: string; badge?: string }) {
  return (
    <Link href={href}
      className="flex items-center justify-between px-4 py-2.5 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-sm font-medium">
      <span>{label}</span>
      {badge && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{badge}</span>}
    </Link>
  )
}
