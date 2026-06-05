import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Create table via raw SQL using service role
  const queries = [
    `CREATE TABLE IF NOT EXISTS business_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'wrap',
      phone TEXT, email TEXT, website TEXT, address TEXT,
      instagram TEXT, facebook TEXT, logo_text TEXT,
      warranty_text TEXT, terms_text TEXT,
      is_active BOOLEAN NOT NULL DEFAULT false,
      tax_rate NUMERIC(5,4) DEFAULT 0.0675,
      deposit_rate NUMERIC(5,4) DEFAULT 0.50,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )`,
    `ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY`,
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='business_profiles' AND policyname='allow_all_bp') THEN CREATE POLICY allow_all_bp ON business_profiles FOR ALL USING (true) WITH CHECK (true); END IF; END $$`,
  ]

  const results = []
  for (const q of queries) {
    const { error } = await sb.rpc('exec_migration', { sql: q }).catch(() => ({ error: null }))
    results.push({ q: q.slice(0, 40), error: error?.message || null })
  }

  // Seed initial data via insert (safer than raw SQL)
  const { data: existing } = await sb.from('business_profiles').select('id').limit(1)
  if (!existing || existing.length === 0) {
    await sb.from('business_profiles').insert([
      {
        name: 'Infinity Wrap Design', type: 'wrap',
        phone: '(919) 649-0755', email: 'infinitywrapdesign@gmail.com',
        website: 'www.infinitywrapdesign.com', address: 'North Carolina',
        instagram: '@infinitywrapdesign', facebook: 'Infinity Wrap Design',
        logo_text: 'IW',
        warranty_text: '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7yr, Avery: 5yr, GF: 5yr).',
        terms_text: 'PAYMENT: 50% deposit required to schedule. Balance due upon completion before delivery.\nDESIGN: Design approval required before printing.\nCANCELLATION: Deposits are non-refundable once materials have been ordered.\nVEHICLE: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.',
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
    results.push({ q: 'INSERT seed data', error: null })
  }

  return NextResponse.json({ done: true, results })
}
