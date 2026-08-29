import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import DocumentPDF from '@/components/DocumentPDF'

// Negocio fijo — la tabla business_profiles no existe en la base real (ver notas del
// proyecto: quedó de una versión más ambiciosa nunca migrada). Estos son los datos
// reales de Infinity Wrap Design, tomados del PDF ya usado en producción.
const BUSINESS_DEFAULT = {
  name: 'Infinity Wrap Design', logoText: 'IW',
  phone: '(919) 649-0755', email: 'infinitywrapdesign@gmail.com',
  website: 'www.infinitywrapdesign.com', address: 'North Carolina',
  instagram: '@infinitywrapdesign', facebook: 'Infinity Wrap Design',
  warrantyText: '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7yr, Avery: 5yr, GF: 5yr).',
  terms: 'PAYMENT: 50% deposit required to schedule. Balance due upon completion before delivery.\nDESIGN: Design approval required before printing.\nCANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.\nVEHICLE: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.',
}

const INCLUDED_CONCEPTS = [
  'Custom design & digital mockup (proof before printing)',
  'Premium cast vinyl with protective laminate',
  'High-resolution large-format printing',
  'Surface preparation & decontamination',
  'Professional installation by certified installers',
  'Installation workmanship warranty',
]

function fmtDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function GET(req: NextRequest, context: any) {
  const params = await context.params
  const id = params.id
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const sb = createClient(supabaseUrl, serviceKey)

  const [{ data: q, error }, { data: lineItems }] = await Promise.all([
    sb.from('quotes').select('*, client:clients(*)').eq('id', id).single(),
    sb.from('line_items').select('*').eq('quote_id', id).order('sort_order'),
  ])

  if (error || !q) return NextResponse.json({ error: 'Quote not found' }, { status: 404 })

  const client = q.client || {}
  const items = (lineItems || []).map((li: any) => ({
    label: li.description || 'Service',
    description: '',
    qty: li.qty ?? 1,
    unitPrice: li.price ?? 0,
    subtotal: (li.qty ?? 1) * (li.price ?? 0),
  }))

  const discount = (q.discount_amount || 0) > 0
    ? { label: q.discount_type === 'Percent' ? `Discount (${q.discount_value}%)` : 'Discount', amount: q.discount_amount }
    : undefined

  const total   = q.final_total || q.total || 0
  const deposit = q.deposit || Math.round(total * 0.5 * 100) / 100
  const balance = Math.round((total - deposit) * 100) / 100

  const doc = {
    type: 'quote' as const, docNumber: q.doc_number, status: q.status,
    date: fmtDate(q.date_issued || q.created_at),
    validUntil: q.due_date ? fmtDate(q.due_date) : fmtDate(new Date(Date.now() + 30*86400000).toISOString()),
    business: BUSINESS_DEFAULT,
    client: { name: client.name || '—', company: client.contact_name || '', phone: client.phone || '', email: client.email || '' },
    items,
    subtotal: q.subtotal || 0, tax: q.tax_amt || 0, taxRate: q.tax_rate || 0.0675,
    total, deposit, balance, notes: q.notes || '', depositRate: 50,
    discount, includedConcepts: INCLUDED_CONCEPTS,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(DocumentPDF as any, { doc }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${q.doc_number}.pdf"` }
  })
}
