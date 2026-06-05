'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, WARRANTY_TEXT, TERMS_TEXT } from '@/lib/quote-engine'
import { ArrowLeft, Printer, CheckCircle, XCircle, Clock, FileText, Zap, FolderOpen } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

const STATUS_COLORS: Record<string, string> = {
  draft:    'bg-gray-100 text-gray-600',
  sent:     'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

function formatDate(iso?: string) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function QuoteDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [quote,      setQuote]      = useState<any>(null)
  const [client,     setClient]     = useState<any>(null)
  const [loading,    setLoading]    = useState(true)
  const [updating,   setUpdating]   = useState(false)
  const [converting, setConverting] = useState(false)
  const [invoiceId,  setInvoiceId]  = useState<string|null>(null)
  const [projectId,  setProjectId]  = useState<string|null>(null)
  const [success,    setSuccess]    = useState('')
  const [convErr,    setConvErr]    = useState('')

  const handlePrint = useReactToPrint({ contentRef: printRef })

  useEffect(() => {
    if (!id) return
    supabase.from('quotes').select('*, client:clients(*)').eq('id', id).single()
      .then(({ data }) => { if (data) { setQuote(data); setClient(data.client) }; setLoading(false) })
    supabase.from('invoices').select('id, project_id').eq('quote_id', id).maybeSingle()
      .then(({ data }) => { if (data) { setInvoiceId(data.id); if (data.project_id) setProjectId(data.project_id) } })
    supabase.from('projects').select('id').eq('quote_id', id).maybeSingle()
      .then(({ data }) => { if (data) setProjectId(data.id) })
  }, [id])

  async function updateStatus(status: string) {
    setUpdating(true)
    await supabase.from('quotes').update({ status, accepted_at: status==='approved' ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq('id', id)
    setQuote((q: any) => ({ ...q, status }))
    setUpdating(false)
  }

  async function convertToProject() {
    if (!quote) return
    setConverting(true); setConvErr('')
    const now = new Date().toISOString()

    // Build service summary from items
    const itemsList = quote.items || []
    const serviceSummary = itemsList.map((i: any) => i.label).filter(Boolean).join(', ') || 'Services'

    // 1. Create Project
    const { data: project, error: pe } = await supabase.from('projects').insert({
      name:         `${client?.name || 'Client'} — ${serviceSummary.slice(0, 80)}`,
      client_id:    quote.client_id,
      quote_id:     quote.id,          // added in migration
      status:       'quoted',
      total_amount: quote.total,
      service_description: serviceSummary, // added in migration
      notes:        quote.notes || null,
      start_date:   now.split('T')[0],
    }).select().single()

    if (pe || !project) {
      // Fallback: try without new columns if migration hasn't run
      const { data: p2, error: pe2 } = await supabase.from('projects').insert({
        name:         `${client?.name || 'Client'} — ${serviceSummary.slice(0, 80)}`,
        client_id:    quote.client_id,
        status:       'quoted',
        total_amount: quote.total,
        notes:        quote.notes || null,
        start_date:   now.split('T')[0],
      }).select().single()
      if (pe2 || !p2) { setConvErr('Error creating project: ' + (pe2?.message || pe?.message)); setConverting(false); return }
      return finishConvert(p2, now)
    }
    finishConvert(project, now)
  }

  async function finishConvert(project: any, now: string) {
    // 2. Create Invoice
    const rand = Math.floor(Math.random() * 9000) + 1000
    const yy = now.slice(2,4); const mm = now.slice(5,7)
    const invoiceNumber = `INV-${yy}${mm}-${rand}`
    const due = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    const deposit = Math.round((quote.total || 0) * 0.5 * 100) / 100
    const balance = Math.round(((quote.total || 0) - deposit) * 100) / 100

    const { data: invoice, error: ie } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      quote_id:       quote.id,
      client_id:      quote.client_id,
      project_id:     project.id,
      items:          quote.items || [],
      subtotal:       quote.subtotal || 0,
      tax_rate:       quote.tax_rate || 0.0675,
      tax_amount:     quote.tax_amount || 0,
      total:          quote.total || 0,
      deposit_amount: deposit,
      balance_due:    balance,
      status:         'unpaid',
      due_date:       due,
      notes:          quote.notes || null,
    }).select().single()

    if (ie || !invoice) { setConvErr('Error creating invoice: ' + ie?.message); setConverting(false); return }

    // 3. Link invoice back to project (if column exists)
    await supabase.from('projects').update({ invoice_id: invoice.id }).eq('id', project.id)

    // 4. Mark quote approved + linked
    await supabase.from('quotes').update({ status: 'approved', accepted_at: now, updated_at: now }).eq('id', id)
    setQuote((q: any) => ({ ...q, status: 'approved' }))
    setInvoiceId(invoice.id)
    setProjectId(project.id)
    setConverting(false)
    setSuccess(`✓ Project & Invoice created — ${invoiceNumber}`)
    setTimeout(() => setSuccess(''), 8000)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Loading quote...</div>
  if (!quote)  return <div className="flex items-center justify-center h-64 text-gray-400">Quote not found</div>

  const items    = quote.items || []
  const subtotal = quote.subtotal   || 0
  const tax      = quote.tax_amount || 0
  const total    = quote.total      || 0
  const deposit  = Math.round(total * 0.5  * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  const expires  = quote.expires_at ? formatDate(quote.expires_at) : '30 days from issue'
  const alreadyConverted = !!invoiceId && !!projectId

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Controls bar */}
        <div className="flex items-center justify-between mb-6 print:hidden flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/quotes')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
              <ArrowLeft size={20}/>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{quote.quote_number}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[quote.status]}`}>
                {quote.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {quote.status !== 'approved' && (
              <button onClick={() => updateStatus('approved')} disabled={updating}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
                <CheckCircle size={14}/> Approve
              </button>
            )}
            {quote.status !== 'rejected' && (
              <button onClick={() => updateStatus('rejected')} disabled={updating}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-semibold">
                <XCircle size={14}/> Reject
              </button>
            )}
            {quote.status === 'draft' && (
              <button onClick={() => updateStatus('sent')} disabled={updating}
                className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
                <Clock size={14}/> Mark Sent
              </button>
            )}

            {alreadyConverted ? (
              <div className="flex gap-2">
                <button onClick={() => router.push(`/projects/${projectId}`)}
                  className="flex items-center gap-1.5 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-bold">
                  <FolderOpen size={14}/> View Project
                </button>
                <button onClick={() => router.push(`/invoices/${invoiceId}`)}
                  className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold">
                  <FileText size={14}/> View Invoice
                </button>
              </div>
            ) : (
              <button onClick={convertToProject} disabled={converting}
                className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-bold">
                <Zap size={15} className="text-orange-400"/>
                {converting ? 'Creating...' : '⚡ Convert → Project + Invoice'}
              </button>
            )}

            <button onClick={() => handlePrint()}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold">
              <Printer size={14}/> Print / PDF
            </button>
          </div>
        </div>

        {/* Success banner */}
        {success && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <CheckCircle size={18} className="text-green-600 shrink-0"/>
            <p className="font-semibold text-green-800 text-sm">{success}</p>
            <div className="ml-auto flex gap-2">
              <button onClick={() => router.push(`/projects/${projectId}`)}
                className="text-xs bg-purple-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-600">
                Ver Proyecto →
              </button>
              <button onClick={() => router.push(`/invoices/${invoiceId}`)}
                className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-orange-600">
                Ver Invoice →
              </button>
            </div>
          </div>
        )}
        {convErr && (
          <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-5 py-3 text-red-700 text-sm">{convErr}</div>
        )}

        {/* ── PRINTABLE QUOTE ── */}
        <div ref={printRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:rounded-none print:border-0">

          {/* Header */}
          <div className="bg-gray-900 text-white px-8 py-7">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-black tracking-tight text-orange-400">INFINITY</div>
                <div className="text-2xl font-black tracking-tight">WRAP DESIGN</div>
                <div className="text-gray-400 text-sm mt-2">(919) 649-0755</div>
                <div className="text-gray-400 text-sm">infinitywrapdesign@gmail.com</div>
                <div className="text-gray-400 text-sm">North Carolina</div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-orange-400 tracking-tight">QUOTE</div>
                <div className="text-gray-300 text-sm mt-2 font-mono">{quote.quote_number}</div>
                <div className="text-gray-400 text-sm mt-1">Date: {formatDate()}</div>
                <div className="text-gray-400 text-sm">Valid: {expires}</div>
                <div className={`mt-3 inline-block text-xs font-bold px-3 py-1 rounded-full ${
                  quote.status==='approved' ? 'bg-green-500' :
                  quote.status==='rejected' ? 'bg-red-500' :
                  quote.status==='sent'     ? 'bg-blue-500' : 'bg-gray-500'} text-white`}>
                  {quote.status.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Bill To */}
          <div className="px-8 py-5 bg-orange-50 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
                <p className="font-bold text-gray-900 text-lg">{client?.name || '—'}</p>
                {client?.company && <p className="text-gray-600 text-sm">{client.company}</p>}
                {client?.phone   && <p className="text-gray-600 text-sm">{client.phone}</p>}
                {client?.email   && <p className="text-gray-600 text-sm">{client.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Quote Details</p>
                <p className="text-sm text-gray-600">Quote #: <span className="font-semibold text-gray-900">{quote.quote_number}</span></p>
                <p className="text-sm text-gray-600">Valid: <span className="font-semibold">30 days</span></p>
                <p className="text-sm text-gray-600">Tax Rate: <span className="font-semibold">6.75% (NC)</span></p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="px-8 py-6">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">Service / Description</th>
                  <th className="text-center py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-20">Qty</th>
                  <th className="text-right py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-28">Unit $</th>
                  <th className="text-right py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No line items</td></tr>
                ) : items.map((item: any, i: number) => (
                  <tr key={i} className={`border-b border-gray-100 ${i%2===1?'bg-gray-50':''}`}>
                    <td className="py-4">
                      <p className="font-semibold text-gray-900">{item.label}</p>
                      {item.description && <p className="text-gray-500 text-sm mt-0.5">{item.description}</p>}
                    </td>
                    <td className="py-4 text-center text-sm text-gray-600">{item.qty ?? 1}</td>
                    <td className="py-4 text-right text-sm text-gray-600">{formatCurrency(item.unitPrice ?? 0)}</td>
                    <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.subtotal ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-8 pb-6">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Subtotal</span><span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Tax (6.75% NC)</span><span className="font-semibold">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between py-2.5 bg-gray-900 rounded-lg px-3 mt-2">
                  <span className="text-white font-bold text-base">TOTAL</span>
                  <span className="text-orange-400 font-black text-xl">{formatCurrency(total)}</span>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 mt-2 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700 font-bold">50% Deposit Due</span>
                    <span className="text-orange-700 font-black">{formatCurrency(deposit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Balance on Completion</span>
                    <span className="text-gray-700 font-semibold">{formatCurrency(balance)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {quote.notes && (
            <div className="px-8 pb-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-blue-800 whitespace-pre-line">{quote.notes}</p>
              </div>
            </div>
          )}

          {/* Warranty */}
          <div className="px-8 pb-5">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">✓ Warranty</p>
              <p className="text-xs text-green-700">{WARRANTY_TEXT}</p>
            </div>
          </div>

          {/* Terms */}
          <div className="px-8 pb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Terms & Conditions</p>
            <div className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{TERMS_TEXT}</div>
          </div>

          {/* Signature */}
          <div className="px-8 pb-8">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Client Acceptance</p>
              <div className="grid grid-cols-2 gap-8">
                <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Client Signature</p></div>
                <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Date</p></div>
                <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Printed Name</p></div>
                <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Deposit Amount Paid</p></div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-900 px-8 py-4 text-center">
            <p className="text-gray-400 text-xs">Thank you for your business! · Infinity Wrap Design · (919) 649-0755 · infinitywrapdesign@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
