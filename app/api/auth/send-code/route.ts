import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Infinity Manager is a single-owner internal tool — there is no real
// multi-user system yet. The login screen still asks for an "email" so it
// looks and behaves like a normal login, but whatever is typed there is
// never actually used to decide where the code goes: every verification
// code is sent to the owner's real inbox, always. That inbox is the only
// thing that can complete a login.
const OWNER_EMAIL = 'edeltorocruz@gmail.com'

export async function POST(_req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.auth.signInWithOtp({
    email: OWNER_EMAIL,
    options: { shouldCreateUser: true },
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
