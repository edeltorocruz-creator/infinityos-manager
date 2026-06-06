'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Quote } from '@/types'
import { formatCurrency } from '@/lib/quote-engine'
import Link from 'next/link'
import {
  Plus, FileText, CheckCircle, XCircle, Send, Clock,
  ChevronDown, ChevronUp, ExternalLink, FolderPlus
} from 'lucide-react'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:    { label: 'Draft',    color: 'bg-gray-100 text-gray-700' },
  sent:     { label: 'Sent',     color: 'bg-blue-100 text-blue-700' },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
}

type QuoteRow = Quote & { client: any }

export default function QuotesPage() {
  const router = useRouter()
  const [quotes, setQuotes] = useState<QuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  // Track which quote rows are expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { loadQuotes() }, [])

  async function loadQuotes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('quotes')
      .select('*, client:clients(name, email, phone, company)')
      .order('created_at', { ascending: false })
    if (!error && data) setQuotes(data as any)
    setLoading(false)
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function convertToProject(quote: QuoteRow) {
    const { data, error } = await supabase.from('projects').insert({
      client_id: quote.client_id,
      name: `${quote.client?.name} — ${quote.quote_number}`,
      status: 'quoted',
      total_amount: quote.total,
      notes: `Converted from Quote ${quote.quote_number}`,
    }).select().single()

    if (!error && data) {
      await supabase.from('quotes').update({
        project_id: data.id,
        status: 'approved',
        accepted_at: new Date().toISOString()
      }).eq('id', quote.id)
      alert(`✅ Project created: ${data.name}`)
      loadQuotes()
    }
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('quotes').update({ status }).eq('id', id)
    setQuotes(qs => qs.map(q => q.id === id ? { ...q, status: status as any } : q))
  }

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)
  const stats = {
    total:      quotes.length,
    draft:      quotes.filter(q => q.status === 'draft').length,
    sent:       quotes.filter(q => q.status === 'sent').length,
    approved:   quotes.filter(q => q.status === 'approved').length,
    totalValue: quotes.filter(q => q.status === 'approved').reduce((sum, q) => sum + q.total, 0),
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Quotes</h1>
            <p className="text-gray-500 mt-1">Infinity Wrap Design — Quote Management</p>
          </div>
          <Link href="/quotes/new"
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors">
            <Plus size={20}/>
            New Quote
          </Link>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Total Quotes</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Pending / Sent</p>
            <p className="text-3xl font-bold text-blue-600">{stats.draft + stats.sent}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Approved</p>
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Revenue Closed</p>
            <p className="text-2xl font-bold text-orange-500">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        {/* FILTERS */}
        <div className="flex gap-2 mb-6">
          {['all', 'draft', 'sent', 'approved', 'rejected'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filter === f ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
              {f === 'all' ? 'All' : f}
            </button>
          ))}
        </div>

        {/* QUOTES LIST */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading quotes...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <FileText size={48} className="mx-auto text-gray-300 mb-4"/>
            <p className="text-gray-500 text-lg">No quotes yet</p>
            <Link href="/quotes/new" className="text-orange-500 hover:underline mt-2 inline-block">Create your first quote →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(quote => {
              const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft
              const isOpen = expanded.has(quote.id)
              const items: any[] = Array.isArray(quote.items) ? quote.items : []
              const subtotal = items.reduce((s: number, i: any) => s + (i.subtotal || 0), 0)

              return (
                <div key={quote.id}
                  className={`bg-white rounded-xl border shadow-sm transition-shadow ${isOpen ? 'border-orange-200 shadow-md' : 'border-gray-100 hover:shadow-md'}`}>

                  {/* ── COLLAPSED ROW (always visible) ── */}
                  <div
                    className="flex items-center p-5 cursor-pointer select-none"
                    onClick={() => toggleExpand(quote.id)}>

                    {/* Chevron */}
                    <div className="mr-3 text-gray-400 flex-shrink-0">
                      {isOpen ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                    </div>

                    {/* Quote # + status */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="font-bold text-gray-900 text-base whitespace-nowrap">{quote.quote_number}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${status.color}`}>
                        {status.label}
                      </span>
                      <div className="min-w-0">
                        <p className="text-gray-800 font-medium truncate">{quote.client?.name || 'Unknown Client'}</p>
                        {quote.client?.company && (
                          <p className="text-gray-400 text-xs truncate">{quote.client.company}</p>
                        )}
                      </div>
                    </div>

                    {/* Date + items count (hidden on small) */}
                    <div className="hidden md:block text-gray-400 text-sm mx-4 flex-shrink-0">
                      {new Date(quote.created_at || '').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      <span className="ml-2 text-gray-300">· {items.length} item{items.length !== 1 ? 's' : ''}</span>
                    </div>

                    {/* Total — always visible */}
                    <div className="text-right flex-shrink-0 ml-3" onClick={e => e.stopPropagation()}>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(quote.total)}</p>
                      <p className="text-gray-400 text-xs">incl. tax</p>
                    </div>
                  </div>

                  {/* ── EXPANDED PANEL ── */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 pb-5 pt-4">

                      {/* Line items table */}
                      {items.length > 0 ? (
                        <div className="mb-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-100">
                                <th className="text-left pb-2 font-semibold">Service / Item</th>
                                <th className="text-right pb-2 font-semibold w-16">Qty</th>
                                <th className="text-right pb-2 font-semibold w-24">Unit Price</th>
                                <th className="text-right pb-2 font-semibold w-24">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item: any, idx: number) => (
                                <tr key={idx} className="border-b border-gray-50 last:border-0">
                                  <td className="py-2">
                                    <p className="font-medium text-gray-800">{item.label || item.description || 'Item'}</p>
                                    {item.description && item.description !== item.label && (
                                      <p className="text-xs text-gray-400">{item.description}</p>
                                    )}
                                  </td>
                                  <td className="py-2 text-right text-gray-600">{item.qty ?? 1} {item.unit || ''}</td>
                                  <td className="py-2 text-right text-gray-600">{formatCurrency(item.unitPrice ?? 0)}</td>
                                  <td className="py-2 text-right font-semibold text-gray-800">{formatCurrency(item.subtotal ?? 0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm mb-4 italic">No items recorded in this quote.</p>
                      )}

                      {/* Totals summary */}
                      <div className="flex justify-end mb-4">
                        <div className="text-sm space-y-1 min-w-48">
                          <div className="flex justify-between gap-8 text-gray-500">
                            <span>Subtotal</span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between gap-8 text-gray-500">
                            <span>Tax (6.75%)</span>
                            <span>{formatCurrency(quote.total - subtotal > 0 ? quote.total - subtotal : 0)}</span>
                          </div>
                          <div className="flex justify-between gap-8 font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                            <span>Total</span>
                            <span>{formatCurrency(quote.total)}</span>
                          </div>
                          {quote.deposit_amount > 0 && (
                            <div className="flex justify-between gap-8 text-orange-600 font-semibold">
                              <span>Deposit (50%)</span>
                              <span>{formatCurrency(quote.deposit_amount)}</span>
                            </div>
                          )}
                          {quote.balance > 0 && (
                            <div className="flex justify-between gap-8 text-gray-500">
                              <span>Balance due</span>
                              <span>{formatCurrency(quote.balance)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons row */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">

                        {/* Status quick-change */}
                        <select
                          value={quote.status}
                          onChange={e => updateStatus(quote.id, e.target.value)}
                          onClick={e => e.stopPropagation()}
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700">
                          <option value="draft">Draft</option>
                          <option value="sent">Sent</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                        </select>

                        <div className="flex-1"/>

                        {/* View / PDF */}
                        <button
                          onClick={e => { e.stopPropagation(); router.push(`/quotes/${quote.id}`) }}
                          className="flex items-center gap-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                          <ExternalLink size={13}/>
                          View / PDF
                        </button>

                        {/* Convert to Invoice */}
                        {(quote.status === 'approved' || quote.status === 'sent') && (
                          <button
                            onClick={e => { e.stopPropagation(); router.push(`/invoices?fromQuote=${quote.id}`) }}
                            className="flex items-center gap-1.5 text-sm bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg transition-colors">
                            <FileText size={13}/>
                            → Invoice
                          </button>
                        )}

                        {/* Convert to Project */}
                        {quote.status === 'approved' && !(quote as any).project_id && (
                          <button
                            onClick={e => { e.stopPropagation(); convertToProject(quote) }}
                            className="flex items-center gap-1.5 text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                            <FolderPlus size={13}/>
                            → Project
                          </button>
                        )}
                      </div>

                      {/* Notes */}
                      {(quote as any).notes && (
                        <p className="mt-3 text-xs text-gray-400 italic border-t border-gray-50 pt-2">
                          Notes: {(quote as any).notes}
                        </p>
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
