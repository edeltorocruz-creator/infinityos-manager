'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, canMarkPaid } from '@/lib/quote-engine'
import { Quote, Client, Expense, Appointment } from '@/types'
import {
  Phone, FileText, DollarSign, Users, Receipt, TrendingUp,
  Plus, RefreshCw, ChevronRight, CheckCircle, Flame,
  Calendar as CalendarIcon, CheckCircle2
} from 'lucide-react'

function timeLabel(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  return `hace ${days}d`
}

interface DashData {
  clientsCount:      number
  openQuotes:        Quote[]
  recentExpenses:    Expense[]
  upcomingAppts:     Appointment[]
  revenueThisMonth:  number   // Ingresos: suma de final_total - tax_amt de cotizaciones Paid este mes (por paid_date)
  expensesThisMonth: number
  pipelineValue:     number   // suma de final_total de cotizaciones abiertas (no Paid ni Cancelled)
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)

  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [quickExpense, setQuickExpense] = useState({ description: '', amount: '', category: 'Materials' })
  const [saving, setSaving] = useState(false)

  // Confirmación "Marcar cobrada" — verde, no roja/Eliminar (bug ya corregido antes, no repetirlo aquí)
  const [confirmPayId, setConfirmPayId] = useState<string | null>(null)

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10)
    const nowIso = new Date().toISOString()

    const [clientsRes, quotesRes, expensesRes, apptsRes, paidThisMonthRes] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('quotes').select('*, client:clients(name,phone)').not('status', 'in', '("Paid","Cancelled")').order('created_at', { ascending: false }),
      supabase.from('expenses').select('*').gte('expense_date', monthStart).lt('expense_date', monthEnd).order('expense_date', { ascending: false }),
      supabase.from('appointments').select('*').gte('start_time', nowIso).order('start_time', { ascending: true }).limit(4),
      supabase.from('quotes').select('final_total, tax_amt, paid_date').eq('status', 'Paid').gte('paid_date', monthStart).lt('paid_date', monthEnd),
    ])

    const openQuotes = (quotesRes.data || []) as any as Quote[]
    const recentExpenses = (expensesRes.data || []) as any as Expense[]
    const upcomingAppts = (apptsRes.data || []) as any as Appointment[]
    const paidThisMonth = paidThisMonthRes.data || []

    // Ingresos: Final Total menos el Tax (el tax no es ingreso real) — misma fórmula que el Artifact
    const revenueThisMonth = paidThisMonth.reduce((s, q: any) => s + ((q.final_total || 0) - (q.tax_amt || 0)), 0)
    const expensesThisMonth = recentExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const pipelineValue = openQuotes.reduce((s, q) => s + (q.final_total || q.total || 0), 0)

    setData({
      clientsCount: clientsRes.count || 0,
      openQuotes: openQuotes.slice(0, 5),
      recentExpenses: recentExpenses.slice(0, 4),
      upcomingAppts,
      revenueThisMonth,
      expensesThisMonth,
      pipelineValue,
    })
    setLoading(false)
  }

  async function saveQuickExpense() {
    if (!quickExpense.description || !quickExpense.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({
      description: quickExpense.description,
      amount: parseFloat(quickExpense.amount),
      category: quickExpense.category,
      expense_date: new Date().toISOString().split('T')[0],
    })
    setSaving(false)
    setShowExpenseModal(false)
    setQuickExpense({ description: '', amount: '', category: 'Materials' })
    loadAll()
  }

  // ── Marcar cobrada — misma lógica ya probada en el Artifact: Status→Paid,
  // Fecha de Pago (paid_date) se pone hoy la primera vez ──
  async function markQuotePaid(id: string) {
    await supabase.from('quotes').update({
      status: 'Paid',
      paid_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }).eq('id', id)
    setConfirmPayId(null)
    loadAll()
  }

  if (loading || !data) return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-400 font-medium">Cargando...</p>
    </div>
  )

  const d = data
  const netThisMonth = d.revenueThisMonth - d.expensesThisMonth

  return (
    <div className="min-h-screen bg-gray-50 p-5">
      <div className="max-w-7xl mx-auto">

        {/* ── TOP HEADER ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">{greeting} · {today}</p>
            <h1 className="text-2xl font-black text-gray-900 mt-0.5 flex items-center gap-2">
              <CheckCircle size={22} className="text-green-500"/>You're on top of it 👊
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><RefreshCw size={16}/></button>
          </div>
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          {[
            { label: 'New Quote',   icon: FileText,   color: 'bg-orange-500', action: () => router.push('/quotes/new') },
            { label: 'Add Expense', icon: Receipt,    color: 'bg-red-500',    action: () => setShowExpenseModal(true) },
            { label: 'Clientes',    icon: Users,      color: 'bg-blue-500',   action: () => router.push('/clients') },
            { label: 'Calendario',  icon: CalendarIcon, color: 'bg-purple-500', action: () => router.push('/calendar') },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className={`${btn.color} hover:opacity-90 text-white rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 transition-opacity`}>
              <btn.icon size={18}/>
              <span className="text-xs font-semibold leading-tight text-center">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* ── RESUMEN ROW ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Clientes',           value: String(d.clientsCount),              color: 'text-gray-900' },
            { label: 'Cotizaciones abiertas', value: String(d.openQuotes.length),       color: 'text-blue-600' },
            { label: 'Ingresos este mes',  value: formatCurrency(d.revenueThisMonth),  color: 'text-green-600' },
            { label: 'Gastos este mes',    value: formatCurrency(d.expensesThisMonth), color: 'text-red-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── COTIZACIONES ABIERTAS ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-900 flex items-center gap-2">
              <FileText size={16} className="text-blue-500"/>Cotizaciones Abiertas
              {d.openQuotes.length > 0 && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{d.openQuotes.length}</span>}
            </p>
            <button onClick={() => router.push('/quotes')} className="text-xs text-orange-500 font-semibold hover:text-orange-700 flex items-center gap-1">
              Ver todas <ChevronRight size={12}/>
            </button>
          </div>
          {d.openQuotes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">No hay cotizaciones abiertas</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {d.openQuotes.map((q: any) => (
                <div key={q.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0 cursor-pointer" onClick={() => router.push(`/quotes/${q.id}`)}>
                    <p className="text-sm font-semibold text-gray-900 truncate">{q.doc_number} · {q.client?.name || 'Sin cliente'}</p>
                    <p className="text-xs text-gray-400">{q.status}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(q.final_total || q.total)}</span>
                    {canMarkPaid(q.status) && (
                      confirmPayId === q.id ? (
                        <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-lg px-2 py-1">
                          <span className="text-xs text-green-800 font-medium">¿Cobrada?</span>
                          <button onClick={() => markQuotePaid(q.id)} className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-2 py-1 rounded-md">Sí</button>
                          <button onClick={() => setConfirmPayId(null)} className="text-gray-400 hover:text-gray-600 text-xs px-1">×</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmPayId(q.id)}
                          className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors">
                          <CheckCircle2 size={12}/>Marcar cobrada
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── GASTOS RECIENTES + PROXIMOS EVENTOS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 flex items-center gap-2"><Receipt size={16} className="text-red-500"/>Gastos Recientes</p>
              <button onClick={() => router.push('/expenses')} className="text-xs text-orange-500 font-semibold hover:text-orange-700 flex items-center gap-1">
                Ver todos <ChevronRight size={12}/>
              </button>
            </div>
            {d.recentExpenses.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No hay gastos este mes</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {d.recentExpenses.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{e.description || e.category}</p>
                      <p className="text-xs text-gray-400">{e.category} · {timeLabel(e.expense_date)}</p>
                    </div>
                    <span className="text-sm font-bold text-red-500 flex-shrink-0 ml-2">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 flex items-center gap-2"><CalendarIcon size={16} className="text-purple-500"/>Próximos Eventos</p>
              <button onClick={() => router.push('/calendar')} className="text-xs text-orange-500 font-semibold hover:text-orange-700 flex items-center gap-1">
                Ver calendario <ChevronRight size={12}/>
              </button>
            </div>
            {d.upcomingAppts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No hay eventos próximos</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {d.upcomingAppts.map(a => (
                  <div key={a.id} className="py-2.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{a.title}</p>
                    <p className="text-xs text-gray-400">{new Date(a.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── NET SUMMARY ── */}
        <div className="bg-gray-900 rounded-2xl p-5 text-white">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2"><TrendingUp size={12}/>Resumen del Mes</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400 text-xs">Ingresos</p>
              <p className="text-2xl font-black text-green-400">{formatCurrency(d.revenueThisMonth)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Gastos</p>
              <p className="text-2xl font-black text-red-400">{formatCurrency(d.expensesThisMonth)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Ganancia Neta</p>
              <p className={`text-2xl font-black ${netThisMonth >= 0 ? 'text-white' : 'text-red-400'}`}>
                {formatCurrency(netThisMonth)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-gray-400 text-xs">Pipeline (cotizaciones abiertas): <span className="text-blue-400 font-bold">{formatCurrency(d.pipelineValue)}</span></p>
          </div>
        </div>

      </div>

      {/* ── QUICK EXPENSE MODAL ── */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Receipt size={18} className="text-red-500"/>Quick Add Expense</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Description *</label>
                <input value={quickExpense.description} onChange={e => setQuickExpense({ ...quickExpense, description: e.target.value })}
                  placeholder="What was purchased?"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Amount ($) *</label>
                <input type="number" step="0.01" value={quickExpense.amount} onChange={e => setQuickExpense({ ...quickExpense, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
                <select value={quickExpense.category} onChange={e => setQuickExpense({ ...quickExpense, category: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {['Materials','Equipment','Vehicle','Labor','Marketing','Software','Supplies','Fuel','Insurance','Other'].map(c =>
                    <option key={c} value={c}>{c}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowExpenseModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium">Cancel</button>
              <button onClick={saveQuickExpense} disabled={saving || !quickExpense.description || !quickExpense.amount}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold">
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
