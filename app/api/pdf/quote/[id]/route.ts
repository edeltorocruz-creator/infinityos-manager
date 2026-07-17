import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import DocumentPDF from '@/components/DocumentPDF'

// Default business — used as fallback if DB not available
const BUSINESS_DEFAULT = {
  name: 'Infinity Wrap Design', logoText: 'IW',
  phone: '(919) 649-0755', email: 'infinitywrapdesign@gmail.com',
  website: 'www.infinitywrapdesign.com', address: 'North Carolina',
  instagram: '@infinitywrapdesign', facebook: 'Infinity Wrap Design',
  warrantyText: '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7yr, Avery: 5yr, GF: 5yr).',
  terms: 'PAYMENT: 50% deposit required to schedule. Balance due upon completion before delivery.\nDESIGN: Design approval required before printing.\nCANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.\nVEHICLE: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.',
}

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function GET(req: NextRequest, context: any) {
  const params = await context.params
  const id = params.id
  // Use service_role key server-side to bypass RLS (safe — never exposed to client)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const sb = createClient(supabaseUrl, serviceKey)

  // Load active business profile from DB
  const { data: bizData } = await sb.from('business_profiles').select('*').eq('is_active', true).maybeSingle()
  const biz = bizData ? {
    name:         bizData.name,
    logoText:     bizData.logo_text || bizData.name.slice(0,2).toUpperCase(),
    phone:        bizData.phone || '',
    email:        bizData.email || '',
    website:      bizData.website || '',
    address:      bizData.address || '',
    instagram:    bizData.instagram || '',
    facebook:     bizData.facebook || '',
    warrantyText: bizData.warranty_text || BUSINESS_DEFAULT.warrantyText,
    terms:        bizData.terms_text || BUSINESS_DEFAULT.terms,
  } : BUSINESS_DEFAULT

  const { data: q, error } = await sb.from('quotes')
    .select('*, client:clients(*)').eq('id', id).single()

  if (error || !q) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const client = q.client || {}
  const rawItems = q.items || []
  const discountItem = rawItems.find((i: any) => i.type === 'discount')
  const items  = rawItems.filter((i: any) => i.type !== 'discount').map((i: any) => ({
    label:       i.label       || i.serviceType || 'Service',
    description: i.description || '',
    qty:         i.qty         ?? i.sqft        ?? 1,
    unitPrice:   i.unitPrice   ?? i.price_per_sqft ?? 0,
    subtotal:    i.subtotal    ?? 0,
  }))
  const discount = discountItem
    ? { label: discountItem.label || 'Discount', amount: Math.abs(discountItem.subtotal || 0) }
    : undefined

  const INCLUDED_CONCEPTS = [
    'Custom design & digital mockup (proof before printing)',
    'Premium cast vinyl with protective laminate',
    'High-resolution large-format printing',
    'Surface preparation & decontamination',
    'Professional installation by certified installers',
    'Installation workmanship warranty',
  ]

  const total   = q.total   || 0
  const deposit = Math.round(total * 0.5 * 100) / 100
  const balance = Math.round((total - deposit) * 100) / 100

  const doc = {
    type: 'quote' as const, docNumber: q.quote_number, status: q.status,
    date: fmtDate(q.created_at),
    validUntil: q.expires_at ? fmtDate(q.expires_at) : fmtDate(new Date(Date.now() + 30*86400000).toISOString()),
    business: biz,
    client: { name: client.name || '—', company: client.company || '', phone: client.phone || '', email: client.email || '' },
    items,
    subtotal: q.subtotal || 0, tax: q.tax_amount || 0, taxRate: q.tax_rate || 0.0675,
    total, deposit, balance, notes: q.notes || '', depositRate: 50,
    discount, includedConcepts: INCLUDED_CONCEPTS,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(DocumentPDF as any, { doc }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${q.quote_number}.pdf"` }
  })
}
