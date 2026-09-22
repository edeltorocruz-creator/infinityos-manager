'use client'

import { usePathname } from 'next/navigation'
import NavSidebar from '@/components/NavSidebar'
import { MarixaWidget } from '@/components/MarixaWidget'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/login'

  if (isLoginPage) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen">
      <NavSidebar />
      <main className="flex-1 ml-64">{children}</main>
      <MarixaWidget />
    </div>
  )
}
