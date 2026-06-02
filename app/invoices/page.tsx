'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { FileText, Plus, DollarSign, Clock, CheckCircle, AlertCircle, Search, TrendingUp } from 'lucide-react'

type InvoiceStatus = 'unpaid' | 'deposit_paid' | 'paid' | 'overdue' | 'cancelled'

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  unpaid:       { label: 'Unpaid',       color: 'text-red-700',    bg: 'bg-red-50' },
  deposit_paid: { label: 'Deposit Paid', color: 'text-orange-700', bg: 'bg-orange-50' },
  paid:         { label: 'Paid ✓',       color: 'text-green-700',  bg: 'bg-green-50' },
  overdue:      { label: 'Overdue',      color: 'text-red-800',    bg: 'bg-red-100' },
  cancelled:    { label: 'Cancelled',    color: 'text-gray-500',   bg: 'bg-gray-100' },
}

const STATUSES: InvoiceStatus[] = ['unpaid','deposit_paid','paid','overdue','cancelled']

interface Invoice {
  id: string
  invoice_number: string
  client_id: string | null
  quote_id: string | null
  total: number
  deposit_amount: number
  balance_due: number
  status: InvoiceStatus
  due_date: string | null
  paid_at: string | null
  deposit_paid_at: string | null
  notes: string | null
  payment_method: string | null
  created_at: string
  client?: { name: string; company: string | null }
}

export default function InvoicesPage() {
  const router = useRouter()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => { loadInvoices() }, [])

  async function loadInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, client:clients(name,company)')
      .order('created_at', { ascending: false })
    if (data) setInvoices(data as Invoice[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: InvoiceStatus) {
    const update: any = { status, updated_at: new Date().toISOString() }
    if (status === 'paid') update.paid_at = new Date().toISOString()
    if (status === 'deposit_paid') update.deposit_paid_at = new Date().toISOString()
    await supabase.from('invoices').update(update).eq('id', id)
    setInvoices(inv => inv.map(i => i.id === id ? { ...i, ...update } : i))
  }

  const filtered = useMemo(() => invoices.filter(inv => {
    const matchSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      (inv.client?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || inv.status === filterStatus
    return matchSearch && matchStatus
  }), [invoices, search, filterStatus])

  const stats = useMemo(() => {
    const active = invoices.filter(i => !['paid','cancelled'].includes(i.status))
    return {
      totalInvoiced: invoices.reduce((s, i) => s + i.total, 0),
      totalCollected: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0),
      outstanding: active.reduce((s, i) => s + i.balance_due, 0),
      depositsPending: invoices.filter(i => i.status === 'unpaid').reduce((s, i) => s + i.deposit_amount, 0),
      overdue: invoices.filter(i => i.status === 'overdue').length,
      unpaid: invoices.filter(i => i.status === 'unpaid').length,
    }
  }, [invoices])

  const isOverdue = (inv: Invoice) =>
    inv.due_date && new Date(inv.due_date) < new Date() && !['paid','cancelled'].includes(inv.status)

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading invoices...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FileText size={26} className="text-orange-500"/> Invoices
            </h1>
            <p className="text-gray-500 mt-1">Billing & Collections — Infinity Wrap Design</p>
          </div>
          <button onClick={() => router.push('/quotes')}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors">
            <Plus size={18}/>Invoice from Quote
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total Invoiced', value: formatCurrency(stats.totalInvoiced), color: 'text-gray-900', icon: TrendingUp },
            { label: 'Collected', value: formatCurrency(stats.totalCollected), color: 'text-green-600', icon: CheckCircle },
            { label: 'Outstanding', value: formatCurrency(stats.outstanding), color: 'text-orange-500', icon: DollarSign },
            { label: 'Deposits Pending', value: formatCurrency(stats.depositsPending), color: 'text-blue-600', icon: Clock },
            { label: 'Unpaid', value: stats.unpaid, color: 'text-red-600', icon: AlertCircle },
            { label: 'Overdue', value: stats.overdue, color: 'text-red-700', icon: AlertCircle },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['all', ...STATUSES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                {s === 'all' ? 'All' : STATUS_CONFIG[s as InvoiceStatus]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invoice List */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <FileText size={44} className="mx-auto text-gray-300 mb-4"/>
            <p className="text-gray-500 text-lg font-medium">No invoices yet</p>
            <p className="text-gray-400 text-sm mt-1">Open an approved quote and click "Create Invoice"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(inv => {
              const statusCfg = STATUS_CONFIG[inv.status]
              const overdueFlag = isOverdue(inv)
              return (
                <div key={inv.id}
                  onClick={() => router.push(`/invoices/${inv.id}`)}
                  className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer p-5 ${overdueFlag ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="flex items-center gap-4">
                    {/* Invoice # */}
                    <div className="flex-shrink-0 w-36">
                      <p className="font-bold text-gray-900 text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400">{new Date(inv.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>

                    {/* Client */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{inv.client?.name || 'Unknown client'}</p>
                      {inv.client?.company && <p className="text-gray-400 text-xs">{inv.client.company}</p>}
                      {inv.notes && <p className="text-gray-400 text-xs italic mt-0.5 truncate">{inv.notes}</p>}
                    </div>

                    {/* Status badge */}
                    <div className="flex-shrink-0">
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                        {overdueFlag && inv.status !== 'overdue' ? '⚠ OVERDUE' : statusCfg.label}
                      </span>
                      {inv.due_date && (
                        <p className="text-xs text-gray-400 mt-1 text-center">Due {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                      )}
                    </div>

                    {/* Amounts */}
                    <div className="flex-shrink-0 text-right min-w-36">
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(inv.total)}</p>
                      {inv.status !== 'paid' && (
                        <p className="text-sm text-orange-500 font-semibold">Balance: {formatCurrency(inv.balance_due)}</p>
                      )}
                      {inv.status === 'deposit_paid' && (
                        <p className="text-xs text-green-600">Deposit paid ✓</p>
                      )}
                    </div>

                    {/* Quick status update */}
                    <div className="flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <select value={inv.status} onChange={e => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer">
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                      </select>
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
