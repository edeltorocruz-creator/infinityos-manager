'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, WARRANTY_TEXT, TERMS_TEXT } from '@/lib/quote-engine'
import { ArrowLeft, Printer, CheckCircle, XCircle, Clock } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  sent: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function QuoteDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [quote, setQuote] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const handlePrint = useReactToPrint({ contentRef: printRef })

  useEffect(() => {
    if (!id) return
    supabase.from('quotes').select('*, client:clients(*)').eq('id', id).single()
      .then(({ data }) => {
        if (data) { setQuote(data); setClient(data.client) }
        setLoading(false)
      })
  }, [id])

  async function updateStatus(status: string) {
    setUpdating(true)
    await supabase.from('quotes').update({ status, accepted_at: status === 'approved' ? new Date().toISOString() : null }).eq('id', id)
    setQuote((q: any) => ({ ...q, status }))
    setUpdating(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading quote...</div>
  if (!quote) return <div className="flex items-center justify-center h-screen text-gray-400">Quote not found</div>

  const items = quote.items || []
  const subtotal = quote.subtotal || 0
  const tax = quote.tax_amount || 0
  const total = quote.total || 0
  const deposit = Math.round(total * 0.5 * 100) / 100
  const balance = Math.round((total - deposit) * 100) / 100
  const expires = quote.expires_at ? new Date(quote.expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Controls (not printed) */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/quotes')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20}/></button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{quote.quote_number}</h1>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_COLORS[quote.status]}`}>{quote.status.toUpperCase()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {quote.status !== 'approved' && (
              <button onClick={() => updateStatus('approved')} disabled={updating}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <CheckCircle size={15}/>Approve
              </button>
            )}
            {quote.status !== 'rejected' && (
              <button onClick={() => updateStatus('rejected')} disabled={updating}
                className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <XCircle size={15}/>Reject
              </button>
            )}
            {quote.status === 'draft' && (
              <button onClick={() => updateStatus('sent')} disabled={updating}
                className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <Clock size={15}/>Mark Sent
              </button>
            )}
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Printer size={15}/>Print / PDF
            </button>
          </div>
        </div>

        {/* PRINTABLE QUOTE */}
        <div ref={printRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:rounded-none">

          {/* HEADER */}
          <div className="bg-gray-900 text-white px-8 py-6 print:py-8">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-black tracking-tight text-orange-400">INFINITY</div>
                <div className="text-2xl font-black tracking-tight">WRAP DESIGN</div>
                <div className="text-gray-400 text-sm mt-1">(919) 649-0755</div>
                <div className="text-gray-400 text-sm">infinitywrapdesign@gmail.com</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-orange-400">QUOTE</div>
                <div className="text-gray-300 text-sm mt-1">{quote.quote_number}</div>
                <div className="text-gray-300 text-sm">Date: {formatDate()}</div>
                <div className="text-gray-300 text-sm">Valid until: {expires}</div>
                <div className={`mt-2 inline-block text-xs font-bold px-3 py-1 rounded-full ${
                  quote.status === 'approved' ? 'bg-green-500 text-white' :
                  quote.status === 'rejected' ? 'bg-red-500 text-white' :
                  quote.status === 'sent' ? 'bg-blue-500 text-white' :
                  'bg-gray-500 text-white'}`}>
                  {quote.status.toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* CLIENT INFO */}
          <div className="px-8 py-5 bg-orange-50 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Bill To</p>
                <p className="font-bold text-gray-900 text-lg">{client?.name || '—'}</p>
                {client?.company && <p className="text-gray-600 text-sm">{client.company}</p>}
                {client?.phone && <p className="text-gray-600 text-sm">{client.phone}</p>}
                {client?.email && <p className="text-gray-600 text-sm">{client.email}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Quote Details</p>
                <p className="text-sm text-gray-600">Quote #: <span className="font-semibold text-gray-900">{quote.quote_number}</span></p>
                <p className="text-sm text-gray-600">Valid for: <span className="font-semibold text-gray-900">30 days</span></p>
                <p className="text-sm text-gray-600">Tax Rate: <span className="font-semibold text-gray-900">6.75% (NC)</span></p>
              </div>
            </div>
          </div>

          {/* ITEMS TABLE */}
          <div className="px-8 py-5">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">Description</th>
                  <th className="text-center py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-16">L (ft)</th>
                  <th className="text-center py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-20">Sq Ft</th>
                  <th className="text-right py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any, i: number) => (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 1 ? 'bg-gray-50' : ''}`}>
                    <td className="py-4">
                      <p className="font-semibold text-gray-900">{item.label}</p>
                      {item.description && item.description !== item.label && (
                        <p className="text-gray-500 text-sm">{item.description}</p>
                      )}
                      {item.notes && <p className="text-gray-400 text-xs italic mt-0.5">{item.notes}</p>}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                        {item.price_per_sqft > 0 && <span>${item.price_per_sqft}/sqft</span>}
                        {item.extra_rate && <span>+${item.extra_rate}/sqft</span>}
                      </div>
                    </td>
                    <td className="py-4 text-center text-sm text-gray-600">{item.L || '—'}</td>
                    <td className="py-4 text-center text-sm text-gray-600">{item.sqft > 0 ? item.sqft : '—'}</td>
                    <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTALS */}
          <div className="px-8 pb-5">
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Tax (6.75% NC)</span>
                  <span className="font-semibold">{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between py-2 bg-gray-900 rounded-lg px-3 mt-2">
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

          {/* NOTES */}
          {quote.notes && (
            <div className="px-8 pb-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-blue-800 whitespace-pre-line">{quote.notes}</p>
              </div>
            </div>
          )}

          {/* WARRANTY */}
          <div className="px-8 pb-5">
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-1">✓ Warranty</p>
              <p className="text-xs text-green-700">{WARRANTY_TEXT}</p>
            </div>
          </div>

          {/* TERMS */}
          <div className="px-8 pb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Terms & Conditions</p>
            <div className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{TERMS_TEXT}</div>
          </div>

          {/* SIGNATURE */}
          <div className="px-8 pb-8">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Client Acceptance</p>
              <p className="text-xs text-gray-400 mb-6">By signing below, I agree to the terms of this quote and authorize Infinity Wrap Design to proceed with the work described above.</p>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <div className="border-b border-gray-300 h-10 mb-1"></div>
                  <p className="text-xs text-gray-400">Client Signature</p>
                </div>
                <div>
                  <div className="border-b border-gray-300 h-10 mb-1"></div>
                  <p className="text-xs text-gray-400">Date</p>
                </div>
                <div>
                  <div className="border-b border-gray-300 h-10 mb-1"></div>
                  <p className="text-xs text-gray-400">Printed Name</p>
                </div>
                <div>
                  <div className="border-b border-gray-300 h-10 mb-1"></div>
                  <p className="text-xs text-gray-400">Deposit Amount Paid</p>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="bg-gray-900 px-8 py-4 text-center">
            <p className="text-gray-400 text-xs">Thank you for your business! · Infinity Wrap Design · (919) 649-0755 · infinitywrapdesign@gmail.com</p>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #printable, #printable * { visibility: visible; }
          #printable { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
