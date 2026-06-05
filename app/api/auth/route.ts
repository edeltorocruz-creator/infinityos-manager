import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  
  if (error) return NextResponse.json({ error: error.message }, { status: 401 })
  
  const res = NextResponse.json({ 
    access_token: data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    user: data.user?.email
  })
  
  // Set the cookie that the proxy middleware checks
  const cookieName = `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL!.split('//')[1].split('.')[0]}-auth-token`
  const cookieVal  = JSON.stringify({
    access_token:  data.session?.access_token,
    refresh_token: data.session?.refresh_token,
    expires_at:    data.session?.expires_at,
    token_type:    'bearer',
    user:          data.user,
  })
  
  res.cookies.set(cookieName, cookieVal, {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    maxAge: 3600,
    path: '/'
  })
  
  return res
}
