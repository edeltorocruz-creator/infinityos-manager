'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Quote, LineItem } from '@/types'
import { formatCurrency, STATUS_CONFIG, STATUS_OPTIONS, canMarkPaid } from '@/lib/quote-engine'
import Link from 'next/link'
import {
  Plus, FileText, ChevronDown, ChevronUp, ExternalLink, Trash2, CheckCircle2
} from 'lucide-react'

type QuoteRow = Quote & { client: any }

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lineItemsByQuote, setLineItemsByQuote] = useState<Record<string, LineItem[]>>({})
  // Confirmación afirmativa (verde) para "Marcar cobrada" — nunca reusar un diálogo
  // de "Eliminar" en rojo para esta acción, fue un bug real ya corregido antes.
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null)

  useEffect(() => { loadQuotes() }, [])

  async function loadQuotes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('quotes')
      .select('*, client:clients(name, phone, email)')
      .order('created_at', { ascending: false })
    if (!error && data) setQuotes(data as any)
    setLoading(false)
  }

  async function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!lineItemsByQuote[id]) {
      const { data } = await supabase.from('line_items').select('*').eq('quote_id', id).order('sort_order')
      setLineItemsByQuote(prev => ({ ...prev, [id]: data || [] }))
    }
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('quotes').update({ status }).eq('id', id)
    setQuotes(qs => qs.map(q => q.id === id ? { ...q, status: status as any } : q))
  }

  // ── Marcar cobrada — Status→Paid + paid_date de hoy. Misma lógica probada en el Artifact. ──
  async function markQuotePaid(id: string) {
    await supabase.from('quotes').update({
      status: 'Paid',
      paid_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setConfirmPayId(null)
    loadQuotes()
  }

  async function deleteQuote(id: string) {
    if (!confirm('¿Borrar esta cotización? Se borrarán también sus líneas de detalle. No se puede deshacer.')) return
    await supabase.from('line_items').delete().eq('quote_id', id)
    await supabase.from('quotes').delete().eq('id', id)
    loadQuotes()
  }

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)
  const stats = {
    total:      quotes.length,
    open:       quotes.filter(q => canMarkPaid(q.status)).length,
    paid:       quotes.filter(q => q.status === 'Paid').length,
    revenue:    quotes.filter(q => q.status === 'Paid').reduce((sum, q) => sum + (q.final_total || q.total), 0),
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cotizaciones</h1>
            <p className="text-gray-500 mt-1">Infinity Wrap Design — Quote Management</p>
          </div>
          <Link href="/quotes/new"
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors">
            <Plus size={20}/>
            Nueva Cotización
          </Link>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Total</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Abiertas</p>
            <p className="text-3xl font-bold text-blue-600">{stats.open}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Cobradas (Paid)</p>
            <p className="text-3xl font-bold text-green-600">{stats.paid}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Ingresos (total)</p>
            <p className="text-2xl font-bold text-orange-500">{formatCurrency(stats.revenue)}</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {['all', ...STATUS_OPTIONS].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
              {f === 'all' ? 'Todas' : f}
            </button>
          ))}
        </div>

        {/* QUOTES LIST */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando cotizaciones...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <FileText size={48} className="mx-auto text-gray-300 mb-4"/>
            <p className="text-gray-500 text-lg">No hay cotizaciones todavía</p>
            <Link href="/quotes/new" className="text-orange-500 hover:underline mt-2 inline-block">Crea tu primera cotización →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(quote => {
              const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG.Draft
              const isOpen = expanded.has(quote.id)
              const items = lineItemsByQuote[quote.id] || []
              const total = quote.final_total || quote.total

              return (
                <div key={quote.id}
                  className={`bg-white rounded-xl border shadow-sm transition-shadow ${isOpen ? 'border-orange-200 shadow-md' : 'border-gray-100 hover:shadow-md'}`}>

                  {/* ── COLLAPSED ROW ── */}
                  <div className="flex items-center p-5 cursor-pointer select-none flex-wrap gap-2" onClick={() => toggleExpand(quote.id)}>
                    <div className="mr-1 text-gray-400 flex-shrink-0">
                      {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </div>

                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-bold text-gray-900 text-base whitespace-nowrap">{quote.doc_number}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${status.color}`}>
                        {status.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-gray-800 font-medium truncate">{quote.client?.name || 'Sin cliente'}</p>
                      </div>
                    </div>

                    <div className="hidden md:block text-gray-400 text-sm mx-2 flex-shrink-0">
                      {quote.date_issued && new Date(quote.date_issued).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>

                    <div className="text-right flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(total)}</p>
                      <p className="text-gray-400 text-xs">incl. tax</p>
                    </div>

                    {/* Marcar cobrada — visible directo en la fila, sin abrir el detalle */}
                    {canMarkPaid(quote.status) && (
                      <div onClick={e => e.stopPropagation()} className="flex-shrink-0">
                        {confirmPayId === quote.id ? (
                          <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
                            <span className="text-xs text-green-800 font-medium">¿Cobrada?</span>
                            <button onClick={() => markQuotePaid(quote.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-2.5 py-1 rounded-md">Sí, marcar</button>
                            <button onClick={() => setConfirmPayId(null)} className="text-gray-400 hover:text-gray-600 text-xs px-1">×</button>
                          </div>
                        ) : (
                          <button onClick={() => setConfirmPayId(quote.id)}
                            className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors">
                            <CheckCircle2 size={14}/>Marcar cobrada
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── EXPANDED PANEL ── */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4">
                      {items.length > 0 ? (
                        <div className="mb-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                                <th className="text-left pb-2 font-semibold">Descripción</th>
                                <th className="text-right pb-2 font-semibold w-16">Qty</th>
                                <th className="text-right pb-2 font-semibold w-24">Precio</th>
                                <th className="text-right pb-2 font-semibold w-24">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.id} className="border-b border-gray-50 last:border-0">
                                  <td className="py-2 font-medium text-gray-800">{item.description}</td>
                                  <td className="py-2 text-right text-gray-600">{item.qty}</td>
                                  <td className="py-2 text-right text-gray-600">{formatCurrency(item.price)}</td>
                                  <td className="py-2 text-right font-semibold text-gray-800">{formatCurrency(item.qty * item.price)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm mb-4 italic">Sin líneas de detalle.</p>
                      )}

                      <div className="flex justify-end mb-4">
                        <div className="text-sm space-y-1 min-w-48">
                          <div className="flex justify-between gap-8 text-gray-500">
                            <span>Subtotal</span><span>{formatCurrency(quote.subtotal)}</span>
                          </div>
                          {quote.discount_amount > 0 && (
                            <div className="flex justify-between gap-8 text-green-600 font-semibold">
                              <span>Descuento</span><span>− {formatCurrency(quote.discount_amount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between gap-8 text-gray-500">
                            <span>Tax (6.75%)</span><span>{formatCurrency(quote.tax_amt)}</span>
                          </div>
                          <div className="flex justify-between gap-8 font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                            <span>Total</span><span>{formatCurrency(total)}</span>
                          </div>
                          {quote.status === 'Paid' && quote.paid_date && (
                            <div className="flex justify-between gap-8 text-green-600 text-xs">
                              <span>Cobrada el</span><span>{new Date(quote.paid_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
                        <select
                          value={quote.status}
                          onChange={e => updateStatus(quote.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700">
                          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>

                        <div className="flex-1"/>

                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/quotes/${quote.id}`) }}
                          className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                          <ExternalLink size={13}/>Ver / PDF
                        </button>

                        <button
                          onClick={e => { e.stopPropagation(); deleteQuote(quote.id) }}
                          className="flex items-center gap-1.5 text-sm bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg transition-colors">
                          <Trash2 size={13}/>Borrar
                        </button>
                      </div>

                      {quote.notes && (
                        <p className="mt-3 text-xs text-gray-400 italic border-t border-gray-50 pt-2">Notas: {quote.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
