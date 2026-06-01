import type { Metadata } from 'next'
import './globals.css'
import NavSidebar from '@/components/NavSidebar'

export const metadata: Metadata = {
  title: 'Infinity Wrap Manager OS',
  description: 'Operations Management System — Infinity Wrap Design',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen">
          <NavSidebar />
          <main className="flex-1 ml-64">{children}</main>
        </div>
      </body>
    </html>
  )
}
