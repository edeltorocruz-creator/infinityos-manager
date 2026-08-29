import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Same reasoning as send-code/route.ts: the code that matters was always
// mailed to the owner's inbox, so verification always checks against that
// same fixed email — never whatever was typed in the login form's email box.
const OWNER_EMAIL = 'edeltorocruz@gmail.com'

export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Enter the code' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.verifyOtp({
    email: OWNER_EMAIL,
    token: code.trim(),
    type: 'email',
  })

  if (error || !data.session) {
    return NextResponse.json({ error: error?.message || 'Invalid or expired code' }, { status: 401 })
  }

  const res = NextResponse.json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    user: data.user?.email,
  })

  // Cookie the proxy middleware checks for (presence-only gate for page
  // routing). The real authorization happens per-request via RLS, checked
  // against the JWT the browser Supabase client holds after setSession() —
  // this cookie is just so the middleware can redirect to /login on a fresh
  // page load before any client JS has run.
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
