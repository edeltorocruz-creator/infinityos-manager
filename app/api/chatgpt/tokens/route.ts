// app/api/chatgpt/tokens/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)
  
  const { data, error } = await supabase
    .from('chatgpt_api_tokens')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action, notes, token_to_revoke } = body

  const supabase = createClient(supabaseUrl!, supabaseServiceKey!)

  if (action === 'generate') {
    // Generar nuevo token
    const token = 'cgpt_' + Math.random().toString(36).substring(2, 50)
    
    const { data, error } = await supabase
      .from('chatgpt_api_tokens')
      .insert([{
        token,
        notes: notes || null,
        is_active: true
      }])
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ token: data.token })
  }

  if (action === 'revoke') {
    // Revocar token
    const { error } = await supabase
      .from('chatgpt_api_tokens')
      .update({ is_active: false })
      .eq('token', token_to_revoke)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
