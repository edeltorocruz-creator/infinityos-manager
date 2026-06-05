import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import DocumentPDF from '@/components/DocumentPDF'

const BUSINESS = {
  name:         'Infinity Wrap Design',
  phone:        '(919) 649-0755',
  email:        'infinitywrapdesign@gmail.com',
  address:      'North Carolina',
  warrantyText: '1-year workmanship warranty on installation. Material manufacturer warranty applies.',
  terms:        'PAYMENT: Balance due upon completion before delivery.\nCANCELLATION: Deposits are non-refundable once materials have been ordered.\nLATE PAYMENT: Accounts past due 30 days are subject to a 1.5% monthly finance charge.',
}

function fmtDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export async function GET(req: NextRequest, context: any) {
  const id = context.params.id
  // Use service_role key server-side to bypass RLS (safe — never exposed to client)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const sb = createClient(supabaseUrl, serviceKey)

  const { data: inv, error } = await sb.from('invoices')
    .select('*, client:clients(*), quote:quotes(quote_number)').eq('id', id).single()

  if (error || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

  const client = inv.client || {}
  const items  = (inv.items || []).map((i: any) => ({
    label:       i.label       || i.serviceType || 'Service',
    description: i.description || '',
    qty:         i.qty         ?? i.sqft        ?? 1,
    unitPrice:   i.unitPrice   ?? i.price_per_sqft ?? 0,
    subtotal:    i.subtotal    ?? 0,
  }))

  const isFullyPaid   = inv.status === 'paid'
  const isDepositPaid = inv.status === 'deposit_paid' || isFullyPaid

  const doc = {
    type: 'invoice' as const, docNumber: inv.invoice_number,
    linkedNumber: inv.quote?.quote_number || '',
    status: inv.status, date: fmtDate(inv.created_at),
    dueDate: inv.due_date ? fmtDate(inv.due_date) : '',
    business: BUSINESS,
    client: { name: client.name || '—', company: client.company || '', phone: client.phone || '', email: client.email || '' },
    items,
    subtotal: inv.subtotal || 0, tax: inv.tax_amount || 0, taxRate: inv.tax_rate || 0.0675,
    total: inv.total || 0, deposit: inv.deposit_amount || 0, balance: inv.balance_due || 0,
    notes: inv.notes || '', isFullyPaid, isDepositPaid,
    paymentMethod: inv.payment_method || '', depositRate: 50,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(createElement(DocumentPDF as any, { doc }) as any)
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${inv.invoice_number}.pdf"` }
  })
}
