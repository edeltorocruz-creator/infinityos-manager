import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Check if table exists
  const { data: exists, error: checkErr } = await sb
    .from('business_profiles').select('id').limit(1)

  if (checkErr?.code === 'PGRST204' || checkErr?.message?.includes('does not exist')) {
    return NextResponse.json({ 
      error: 'Table business_profiles does not exist yet. Please run the SQL in supabase/business_profiles_migration.sql via the Supabase SQL editor.',
      sql_file: 'supabase/business_profiles_migration.sql'
    }, { status: 422 })
  }

  // Table exists — seed if empty
  if (!exists || exists.length === 0) {
    const { error: seedErr } = await sb.from('business_profiles').insert([
      {
        name: 'Infinity Wrap Design', type: 'wrap',
        phone: '(919) 649-0755', email: 'infinitywrapdesign@gmail.com',
        website: 'www.infinitywrapdesign.com', address: 'North Carolina',
        instagram: '@infinitywrapdesign', facebook: 'Infinity Wrap Design',
        logo_text: 'IW',
        warranty_text: '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7yr, Avery: 5yr, GF: 5yr).',
        terms_text: 'PAYMENT: 50% deposit required to schedule. Balance due upon completion before delivery.\nDESIGN: Design approval required before printing.\nCANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.\nVEHICLE: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.',
        is_active: true, tax_rate: 0.0675, deposit_rate: 0.50
      },
      {
        name: 'Elite Cleaning Services', type: 'cleaning',
        phone: '', email: '', website: '', address: 'North Carolina',
        logo_text: 'EC',
        warranty_text: 'Satisfaction guaranteed. We will return to address any missed areas within 24 hours.',
        terms_text: 'PAYMENT: Due upon service completion.\nCANCELLATION: 24-hour notice required.\nACCESS: Customer must provide access to property at scheduled time.',
        is_active: false, tax_rate: 0.0675, deposit_rate: 0.50
      }
    ])
    if (seedErr) return NextResponse.json({ error: seedErr.message }, { status: 500 })
    return NextResponse.json({ done: true, seeded: true })
  }

  return NextResponse.json({ done: true, message: `Already has ${exists.length} profiles` })
}
