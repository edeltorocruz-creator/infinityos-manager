import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING'
  const anon    = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'present' : 'MISSING'
  const svc     = process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'MISSING'
  const keyUsed = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Try a quick DB query with the service key
  let dbResult = 'untested'
  try {
    const sb = createClient(url, keyUsed)
    const { data, error } = await sb.from('quotes').select('id').limit(1)
    dbResult = error ? `ERROR: ${error.message}` : `OK - found ${data?.length ?? 0} rows`
  } catch (e: any) {
    dbResult = `EXCEPTION: ${e.message}`
  }

  return NextResponse.json({
    url: url.replace('https://', '').split('.')[0],
    anon_key: anon,
    service_role_key: svc,
    db_query: dbResult,
    key_role: keyUsed ? keyUsed.split('.')[1] ? JSON.parse(atob(keyUsed.split('.')[1])).role : 'undecodable' : 'none'
  })
}
