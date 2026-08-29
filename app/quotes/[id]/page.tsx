'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, WARRANTY_TEXT, TERMS_TEXT, INCLUDED_CONCEPTS, STATUS_CONFIG, STATUS_OPTIONS, canMarkPaid } from '@/lib/quote-engine'
import { ArrowLeft, Printer, FileText, CheckCircle2, Trash2, Paperclip, Loader, X } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

function formatDate(iso?: string | null) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function QuoteDetailPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [quote,      setQuote]      = useState<any>(null)
  const [client,     setClient]     = useState<any>(null)
  const [lineItems,  setLineItems]  = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [updating,   setUpdating]   = useState(false)
  const [confirmPay, setConfirmPay] = useState(false)
  const [attaching,  setAttaching]  = useState(false)
  const [attachError, setAttachError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePrint = useReactToPrint({ contentRef: printRef })

  useEffect(() => {
    if (!id) return
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const [{ data: q }, { data: items }] = await Promise.all([
      supabase.from('quotes').select('*, client:clients(*)').eq('id', id).single(),
      supabase.from('line_items').select('*').eq('quote_id', id).order('sort_order'),
    ])
    if (q) { setQuote(q); setClient(q.client) }
    setLineItems(items || [])
    setLoading(false)
  }

  async function updateStatus(status: string) {
    setUpdating(true)
    await supabase.from('quotes').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setQuote((q: any) => ({ ...q, status }))
    setUpdating(false)
  }

  // ── Marcar cobrada — misma lógica probada en el Artifact: Status→Paid,
  // paid_date se pone hoy la primera vez (no se pisa si ya estaba Paid). ──
  async function markPaid() {
    setUpdating(true)
    const paidDate = quote.paid_date || new Date().toISOString().split('T')[0]
    await supabase.from('quotes').update({
      status: 'Paid', paid_date: paidDate, updated_at: new Date().toISOString(),
    }).eq('id', id)
    setQuote((q: any) => ({ ...q, status: 'Paid', paid_date: paidDate }))
    setConfirmPay(false)
    setUpdating(false)
  }

  // ── Attach a vendor/reference PDF or photo to this quote (receipts get their own
  // scan-and-store flow in Expenses; this is the equivalent for quote-side paperwork
  // — e.g. a supplier's material quote, a signed copy, etc.). ──
  async function handleAttachFile(file: File) {
    if (!file) return
    setAttaching(true)
    setAttachError('')
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
      const filename = `quote-${id}-${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('quote-files')
        .upload(filename, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('quote-files').getPublicUrl(filename)
      await supabase.from('quotes').update({
        attachment_url: urlData.publicUrl,
        attachment_name: file.name,
      }).eq('id', id)
      setQuote((q: any) => ({ ...q, attachment_url: urlData.publicUrl, attachment_name: file.name }))
    } catch (err: any) {
      setAttachError(err.message || 'Upload failed')
    } finally {
      setAttaching(false)
    }
  }

  async function removeAttachment() {
    if (!confirm('¿Quitar el archivo adjunto de esta cotización?')) return
    await supabase.from('quotes').update({ attachment_url: null, attachment_name: null }).eq('id', id)
    setQuote((q: any) => ({ ...q, attachment_url: null, attachment_name: null }))
  }

  async function deleteQuote() {
    if (!confirm('¿Eliminar esta cotización? Se borrarán también sus líneas de detalle. No se puede deshacer.')) return
    await supabase.from('line_items').delete().eq('quote_id', id)
    await supabase.from('quotes').delete().eq('id', id)
    router.push('/quotes')
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Cargando cotización...</div>
  if (!quote)  return <div className="flex items-center justify-center h-64 text-gray-400">Cotización no encontrada</div>

  const subtotal = quote.subtotal || 0
  const tax      = quote.tax_amt  || 0
  const total    = quote.final_total || quote.total || 0
  const discountAmount = quote.discount_amount || 0
  const deposit  = quote.deposit || Math.round(total * 0.5 * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  const statusCfg = STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft

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
              <h1 className="text-xl font-bold text-gray-900">{quote.doc_number}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={quote.status}
              onChange={e => updateStatus(e.target.value)}
              disabled={updating}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>

            {canMarkPaid(quote.status) && (
              confirmPay ? (
                <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  <span className="text-sm text-green-800 font-medium">¿Marcar como cobrada?</span>
                  <button onClick={markPaid} disabled={updating} className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-3 py-1.5 rounded-md">Sí, marcar</button>
                  <button onClick={() => setConfirmPay(false)} className="text-gray-400 hover:text-gray-600 px-1">×</button>
                </div>
              ) : (
                <button onClick={() => setConfirmPay(true)} disabled={updating}
                  className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
                  <CheckCircle2 size={14}/> Marcar cobrada
                </button>
              )
            )}

            <button onClick={() => handlePrint()}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-sm font-semibold">
              <Printer size={14}/> Print
            </button>
            <a href={`/api/pdf/quote/${id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-bold no-underline" style={{textDecoration:'none'}}>
              <FileText size={14}/> Download PDF
            </a>
            <button onClick={deleteQuote}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-semibold">
              <Trash2 size={14}/> Eliminar
            </button>
          </div>
        </div>

        {/* Attachment (vendor quote PDF / photo) */}
        <div className="mb-5 print:hidden">
          <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachFile(f) }}/>
          {quote.attachment_url ? (
            <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
              <Paperclip size={16} className="text-orange-500 flex-shrink-0"/>
              <a href={quote.attachment_url} target="_blank" rel="noreferrer"
                className="text-sm text-blue-600 hover:underline flex-1 truncate">
                {quote.attachment_name || 'Archivo adjunto'}
              </a>
              <button onClick={() => fileInputRef.current?.click()} disabled={attaching}
                className="text-xs text-gray-500 hover:text-gray-700 font-semibold">Reemplazar</button>
              <button onClick={removeAttachment} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <X size={14}/>
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} disabled={attaching}
              className="flex items-center gap-2 bg-white border border-dashed border-gray-300 hover:border-orange-400 hover:bg-orange-50/30 text-gray-500 hover:text-orange-600 px-4 py-3 rounded-xl text-sm font-medium w-full transition-colors">
              {attaching ? <><Loader size={14} className="animate-spin"/>Subiendo...</> : <><Paperclip size={14}/>Adjuntar PDF o foto (cotización de proveedor, referencia, etc.)</>}
            </button>
          )}
          {attachError && <p className="text-xs text-red-600 mt-1.5">{attachError}</p>}
        </div>

        {quote.status === 'Paid' && quote.paid_date && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-5 py-3 text-green-800 text-sm font-semibold print:hidden">
            ✓ Cobrada el {formatDate(quote.paid_date)} — cuenta como ingreso del mes correspondiente en el Dashboard.
          </div>
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
                <div className="text-4xl font-black text-orange-400 tracking-tight">{quote.doc_type === 'Invoice' ? 'INVOICE' : 'QUOTE'}</div>
                <div className="text-gray-300 text-sm mt-2 font-mono">{quote.doc_number}</div>
                <div className="text-gray-400 text-sm mt-1">Date: {formatDate(quote.date_issued)}</div>
                <div className={`mt-3 inline-block text-xs font-bold px-3 py-1 rounded-full ${
                  quote.status==='Paid' ? 'bg-green-500' :
                  quote.status==='Cancelled' ? 'bg-gray-500' :
                  quote.status==='Overdue' ? 'bg-red-500' :
                  quote.status==='Sent'     ? 'bg-blue-500' : 'bg-gray-500'} text-white`}>
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
                {client?.contact_name && <p className="text-gray-600 text-sm">{client.contact_name}</p>}
                {client?.phone   && <p className="text-gray-600 text-sm">{client.phone}</p>}
                {client?.email   && <p className="text-gray-600 text-sm">{client.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Quote Details</p>
                <p className="text-sm text-gray-600">Doc #: <span className="font-semibold text-gray-900">{quote.doc_number}</span></p>
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
                {lineItems.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-gray-400 text-sm">No line items</td></tr>
                ) : lineItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="py-4"><p className="font-semibold text-gray-900">{item.description}</p></td>
                    <td className="py-4 text-center text-sm text-gray-600">{item.qty}</td>
                    <td className="py-4 text-right text-sm text-gray-600">{formatCurrency(item.price)}</td>
                    <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.qty * item.price)}</td>
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
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                    <span className="text-green-600 font-semibold">Discount</span>
                    <span className="text-green-600 font-semibold">− {formatCurrency(discountAmount)}</span>
                  </div>
                )}
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

          {/* This Price Includes */}
          <div className="px-8 pb-5">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-orange-600 uppercase tracking-wide mb-2">This Price Includes</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {INCLUDED_CONCEPTS.map((c, i) => (
                  <p key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-green-600 font-bold shrink-0">✓</span>{c}
                  </p>
                ))}
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="px-8 pb-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-blue-800 whitespace-pre-line">{quote.notes}</p>
              </div>
            </div>
          )}

          <div className="px-8 pb-5">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">✓ Warranty</p>
              <p className="text-xs text-green-700">{WARRANTY_TEXT}</p>
            </div>
          </div>

          <div className="px-8 pb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Terms & Conditions</p>
            <div className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{TERMS_TEXT}</div>
          </div>

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

          <div className="bg-gray-900 px-8 py-4 text-center">
            <p className="text-gray-400 text-xs">Thank you for your business! · Infinity Wrap Design · (919) 649-0755 · infinitywrapdesign@gmail.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}
