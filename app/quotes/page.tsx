'use client'

export const dynamic = 'force-dynamic'


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Quote } from '@/types'
import { formatCurrency } from '@/lib/quote-engine'
import Link from 'next/link'
import { Plus, FileText, CheckCircle, XCircle, Send, Clock } from 'lucide-react'

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  approved: { label: 'Approved', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700', icon: XCircle },
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<(Quote & { client: any })[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    loadQuotes()
  }, [])

  async function loadQuotes() {
    setLoading(true)
    const { data, error } = await supabase
      .from('quotes')
      .select('*, client:clients(name, email, phone, company)')
      .order('created_at', { ascending: false })

    if (!error && data) setQuotes(data as any)
    setLoading(false)
  }

  async function convertToProject(quote: Quote & { client: any }) {
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

  const filtered = filter === 'all' ? quotes : quotes.filter(q => q.status === filter)
  const stats = {
    total: quotes.length,
    draft: quotes.filter(q => q.status === 'draft').length,
    sent: quotes.filter(q => q.status === 'sent').length,
    approved: quotes.filter(q => q.status === 'approved').length,
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
            <Plus size={20} />
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
            <FileText size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No quotes yet</p>
            <Link href="/quotes/new" className="text-orange-500 hover:underline mt-2 inline-block">Create your first quote →</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(quote => {
              const status = STATUS_CONFIG[quote.status] || STATUS_CONFIG.draft
              const StatusIcon = status.icon
              return (
                <div key={quote.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-gray-900 text-lg">{quote.quote_number}</span>
                        <span className={`flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium">{quote.client?.name || 'Unknown Client'}</p>
                      {quote.client?.company && <p className="text-gray-400 text-sm">{quote.client.company}</p>}
                      <p className="text-gray-400 text-sm mt-1">
                        {new Date(quote.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        {' · '}{quote.items?.length || 0} item(s)
                      </p>
                    </div>
                    <div className="text-right ml-6">
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(quote.total)}</p>
                      <p className="text-gray-400 text-sm">incl. tax</p>
                      <div className="flex gap-2 mt-3 justify-end">
                        <Link href={`/quotes/${quote.id}`}
                          className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors">
                          View / PDF
                        </Link>
                        {quote.status === 'approved' && !quote.project_id && (
                          <button onClick={() => convertToProject(quote)}
                            className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors">
                            → Project
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
