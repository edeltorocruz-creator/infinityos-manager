import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico', '/api']

// Re-enabled (2026-08-29, Ronda 7): app verified working end-to-end, login
// now gates real production access via the email-code flow (see
// app/login/page.tsx and app/api/auth/send-code|verify-code).
const LOGIN_ENABLED = true

export function proxy(req: NextRequest) {
  if (!LOGIN_ENABLED) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Check for any Supabase auth cookie
  const allCookies = req.cookies.getAll()
  const hasAuth = allCookies.some(c =>
    c.name.includes('auth-token') ||
    c.name.includes('access-token') ||
    (c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
  )

  if (!hasAuth) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
