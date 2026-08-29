import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Internal service identity — never surfaced to Eduardo, never typed by
// anyone. The username/password he actually types on /login are checked
// against app_login (via the verify_app_login RPC, see the
// username_password_login_system migration). Once that passes, we sign in
// behind the scenes as this fixed, already-confirmed auth account to get a
// real Supabase Auth session — so RLS (is_authorized()) keeps protecting
// every table exactly as before, instead of the login screen being just a
// cosmetic gate.
const INTERNAL_EMAIL = 'infinitywrapdesign@gmail.com'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) {
    return NextResponse.json({ error: 'Enter your username and password' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: ok, error: verifyError } = await supabase.rpc('verify_app_login', {
    p_username: username,
    p_password: password,
  })

  if (verifyError || !ok) {
    return NextResponse.json({ error: 'Incorrect username or password' }, { status: 401 })
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: INTERNAL_EMAIL,
    password: process.env.INTERNAL_AUTH_PASSWORD!,
  })

  if (error || !data.session) {
    return NextResponse.json({ error: 'Login is temporarily unavailable — please try again.' }, { status: 500 })
  }

  const res = NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  })

  // Cookie the proxy middleware checks for (presence-only gate for page
  // routing). The real authorization happens per-request via RLS, checked
  // against the JWT the browser Supabase client holds after setSession().
  const cookieName = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]}-auth-token`
  const cookieVal = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    token_type: 'bearer',
    user: data.user,
  })

  res.cookies.set(cookieName, cookieVal, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })

  return res
}
