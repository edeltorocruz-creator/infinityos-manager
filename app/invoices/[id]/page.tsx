'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, WARRANTY_TEXT, TERMS_TEXT } from '@/lib/quote-engine'
import { ArrowLeft, Printer, CheckCircle, DollarSign, AlertCircle, CreditCard } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'

type InvoiceStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'overdue' | 'cancelled'

const STATUS_COLORS: Record<string, string> = {
  unpaid:       'bg-red-100 text-red-700',
  deposit_paid: 'bg-orange-100 text-orange-700',
  paid:         'bg-green-100 text-green-700',
  overdue:      'bg-red-200 text-red-800',
  cancelled:    'bg-gray-100 text-gray-500',
}

const PAYMENT_METHODS = ['Cash', 'Check', 'Zelle', 'Venmo', 'Card', 'Bank Transfer', 'Other']

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const printRef = useRef<HTMLDivElement>(null)
  const [invoice, setInvoice] = useState<any>(null)
  const [client, setClient] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [showPayModal, setShowPayModal] = useState<'deposit' | 'full' | null>(null)
  const [payMethod, setPayMethod] = useState('Cash')
  const [payNotes, setPayNotes] = useState('')

  const handlePrint = useReactToPrint({ contentRef: printRef })

  useEffect(() => {
    if (!id) return
    supabase.from('invoices').select('*, client:clients(*), quote:quotes(quote_number)')
      .eq('id', id).single()
      .then(({ data }) => {
        if (data) { setInvoice(data); setClient(data.client) }
        setLoading(false)
      })
  }, [id])

  async function markDepositPaid() {
    setUpdating(true)
    const update = {
      status: 'deposit_paid' as InvoiceStatus,
      deposit_paid_at: new Date().toISOString(),
      payment_method: payMethod,
      updated_at: new Date().toISOString(),
      notes: payNotes ? (invoice.notes ? invoice.notes + '\n' + payNotes : payNotes) : invoice.notes
    }
    await supabase.from('invoices').update(update).eq('id', id)
    setInvoice((i: any) => ({ ...i, ...update }))
    setShowPayModal(null); setPayNotes('')
    setUpdating(false)
  }

  async function markFullyPaid() {
    setUpdating(true)
    const update = {
      status: 'paid' as InvoiceStatus,
      paid_at: new Date().toISOString(),
      balance_due: 0,
      payment_method: payMethod,
      updated_at: new Date().toISOString(),
      notes: payNotes ? (invoice.notes ? invoice.notes + '\n' + payNotes : payNotes) : invoice.notes
    }
    await supabase.from('invoices').update(update).eq('id', id)
    setInvoice((i: any) => ({ ...i, ...update }))
    setShowPayModal(null); setPayNotes('')
    setUpdating(false)
  }

  async function markOverdue() {
    setUpdating(true)
    await supabase.from('invoices').update({ status: 'overdue', updated_at: new Date().toISOString() }).eq('id', id)
    setInvoice((i: any) => ({ ...i, status: 'overdue' }))
    setUpdating(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading invoice...</div>
  if (!invoice) return <div className="flex items-center justify-center h-screen text-gray-400">Invoice not found</div>

  const items = invoice.items || []
  const isFullyPaid = invoice.status === 'paid'
  const isDepositPaid = invoice.status === 'deposit_paid'

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Controls */}
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/invoices')} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft size={20}/>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[invoice.status]}`}>
                  {invoice.status.replace('_',' ').toUpperCase()}
                </span>
                {invoice.quote?.quote_number && (
                  <span className="text-xs text-gray-400">from {invoice.quote.quote_number}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Payment actions */}
            {!isFullyPaid && !isDepositPaid && invoice.status !== 'cancelled' && (
              <button onClick={() => setShowPayModal('deposit')} disabled={updating}
                className="flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <DollarSign size={15}/>Mark Deposit Paid
              </button>
            )}
            {!isFullyPaid && invoice.status !== 'cancelled' && (
              <button onClick={() => setShowPayModal('full')} disabled={updating}
                className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                <CheckCircle size={15}/>Mark Fully Paid
              </button>
            )}
            {invoice.status === 'unpaid' && (
              <button onClick={markOverdue} disabled={updating}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                <AlertCircle size={14}/>Overdue
              </button>
            )}
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
              <Printer size={15}/>Print / PDF
            </button>
          </div>
        </div>

        {/* Payment confirmation bar */}
        {isFullyPaid && (
          <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600"/>
            <div>
              <p className="font-bold text-green-800 text-sm">Invoice Fully Paid</p>
              {invoice.paid_at && <p className="text-green-600 text-xs">Paid on {new Date(invoice.paid_at).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}{invoice.payment_method ? ` via ${invoice.payment_method}` : ''}</p>}
            </div>
          </div>
        )}
        {isDepositPaid && !isFullyPaid && (
          <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3 flex items-center gap-3">
            <DollarSign size={20} className="text-orange-500"/>
            <div>
              <p className="font-bold text-orange-800 text-sm">Deposit Received — {formatCurrency(invoice.deposit_amount)}</p>
              <p className="text-orange-600 text-xs">Balance due: {formatCurrency(invoice.balance_due)}{invoice.payment_method ? ` · Paid via ${invoice.payment_method}` : ''}</p>
            </div>
          </div>
        )}

        {/* PRINTABLE INVOICE */}
        <div ref={printRef} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:rounded-none">

          {/* HEADER */}
          <div className="bg-gray-900 text-white px-8 py-6">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-2xl font-black tracking-tight text-orange-400">INFINITY</div>
                <div className="text-2xl font-black tracking-tight">WRAP DESIGN</div>
                <div className="text-gray-400 text-sm mt-1">(919) 649-0755</div>
                <div className="text-gray-400 text-sm">infinitywrapdesign@gmail.com</div>
                <div className="text-gray-400 text-sm">North Carolina</div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-orange-400">INVOICE</div>
                <div className="text-gray-300 text-sm mt-2">{invoice.invoice_number}</div>
                {invoice.quote?.quote_number && <div className="text-gray-400 text-xs">Quote: {invoice.quote.quote_number}</div>}
                <div className="text-gray-300 text-sm">Date: {formatDate()}</div>
                {invoice.due_date && (
                  <div className="text-gray-300 text-sm">Due: {new Date(invoice.due_date).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })}</div>
                )}
                <div className={`mt-2 inline-block text-xs font-bold px-3 py-1 rounded-full ${
                  invoice.status === 'paid' ? 'bg-green-500 text-white' :
                  invoice.status === 'deposit_paid' ? 'bg-orange-500 text-white' :
                  invoice.status === 'overdue' ? 'bg-red-600 text-white' :
                  'bg-gray-500 text-white'}`}>
                  {invoice.status.replace('_',' ').toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* CLIENT */}
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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Invoice Details</p>
                <p className="text-sm text-gray-600">Invoice #: <span className="font-semibold text-gray-900">{invoice.invoice_number}</span></p>
                <p className="text-sm text-gray-600">Tax Rate: <span className="font-semibold text-gray-900">6.75% (NC)</span></p>
                {invoice.payment_method && <p className="text-sm text-gray-600">Payment: <span className="font-semibold text-gray-900">{invoice.payment_method}</span></p>}
              </div>
            </div>
          </div>

          {/* ITEMS */}
          <div className="px-8 py-5">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="text-left py-3 text-xs font-bold text-gray-600 uppercase tracking-wide">Description</th>
                  <th className="text-center py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-20">Sq Ft</th>
                  <th className="text-center py-3 text-xs font-bold text-gray-600 uppercase tracking-wide w-24">Material</th>
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
                        {item.L && <span>L: {item.L} ft</span>}
                        {item.W && item.H && <span>{item.W}ft × {item.H}ft</span>}
                        {item.price_per_sqft > 0 && <span>${item.price_per_sqft}/sqft</span>}
                        {item.complexity && item.complexity !== 'simple' && <span className="capitalize">{item.complexity}</span>}
                      </div>
                    </td>
                    <td className="py-4 text-center text-sm text-gray-600">{item.sqft > 0 ? item.sqft : '—'}</td>
                    <td className="py-4 text-center text-xs text-gray-500 uppercase">{item.material || '—'}</td>
                    <td className="py-4 text-right font-bold text-gray-900">{formatCurrency(item.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TOTALS */}
          <div className="px-8 pb-5">
            <div className="flex justify-end">
              <div className="w-80 space-y-2">
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-semibold">{formatCurrency(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                  <span className="text-gray-500">Tax (6.75% NC)</span>
                  <span className="font-semibold">{formatCurrency(invoice.tax_amount)}</span>
                </div>
                <div className="flex justify-between py-2 bg-gray-900 rounded-lg px-3 mt-2">
                  <span className="text-white font-bold text-base">TOTAL</span>
                  <span className="text-orange-400 font-black text-xl">{formatCurrency(invoice.total)}</span>
                </div>

                {/* Payment breakdown */}
                <div className={`rounded-lg p-4 mt-2 space-y-2.5 ${isFullyPaid ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-100'}`}>
                  <div className="flex justify-between text-sm">
                    <span className={`font-bold ${isFullyPaid ? 'text-green-700' : 'text-orange-700'}`}>
                      {isDepositPaid || isFullyPaid ? '✓ ' : ''}50% Deposit
                    </span>
                    <span className={`font-black ${isFullyPaid ? 'text-green-700' : 'text-orange-700'}`}>{formatCurrency(invoice.deposit_amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-orange-200 pt-2.5">
                    <span className={`font-bold ${isFullyPaid ? 'text-green-700' : 'text-gray-700'}`}>
                      {isFullyPaid ? '✓ Balance — PAID IN FULL' : 'Balance Due on Completion'}
                    </span>
                    <span className={`font-black text-lg ${isFullyPaid ? 'text-green-600' : 'text-gray-900'}`}>{formatCurrency(invoice.balance_due)}</span>
                  </div>
                </div>

                {isFullyPaid && (
                  <div className="text-center pt-2">
                    <span className="text-3xl font-black text-green-500 tracking-widest">PAID IN FULL</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* NOTES */}
          {invoice.notes && (
            <div className="px-8 pb-5">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-blue-800 whitespace-pre-line">{invoice.notes}</p>
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

          {/* PAYMENT INFO */}
          {!isFullyPaid && (
            <div className="px-8 pb-5">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-2">
                  <CreditCard size={12} className="inline mr-1"/>Payment Methods Accepted
                </p>
                <p className="text-sm text-gray-600">Cash · Check (payable to Infinity Wrap Design) · Zelle · Venmo · Card</p>
                <p className="text-xs text-gray-400 mt-1">Please reference invoice number {invoice.invoice_number} with your payment.</p>
              </div>
            </div>
          )}

          {/* TERMS */}
          <div className="px-8 pb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Terms & Conditions</p>
            <div className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">{TERMS_TEXT}</div>
          </div>

          {/* SIGNATURE */}
          {!isFullyPaid && (
            <div className="px-8 pb-8">
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Payment Acknowledgment</p>
                <div className="grid grid-cols-2 gap-8">
                  <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Client Signature</p></div>
                  <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Date</p></div>
                  <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Amount Paid</p></div>
                  <div><div className="border-b border-gray-300 h-10 mb-1"/><p className="text-xs text-gray-400">Payment Method</p></div>
                </div>
              </div>
            </div>
          )}

          {/* FOOTER */}
          <div className="bg-gray-900 px-8 py-4 text-center">
            <p className="text-gray-400 text-xs">Thank you for your business! · Infinity Wrap Design · (919) 649-0755 · infinitywrapdesign@gmail.com</p>
          </div>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {showPayModal === 'deposit' ? 'Record Deposit Payment' : 'Record Full Payment'}
            </h2>
            <p className="text-gray-500 text-sm mb-5">
              {showPayModal === 'deposit'
                ? `Deposit amount: ${formatCurrency(invoice.deposit_amount)}`
                : `Total amount: ${formatCurrency(invoice.total)}`}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map(m => (
                    <button key={m} onClick={() => setPayMethod(m)}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${payMethod === m ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notes (optional)</label>
                <input value={payNotes} onChange={e => setPayNotes(e.target.value)}
                  placeholder="Check #1234, confirmation code, etc."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPayModal(null)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button
                onClick={showPayModal === 'deposit' ? markDepositPaid : markFullyPaid}
                disabled={updating}
                className="flex-1 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-bold">
                {updating ? 'Saving...' : `Confirm ${showPayModal === 'deposit' ? 'Deposit' : 'Full Payment'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
