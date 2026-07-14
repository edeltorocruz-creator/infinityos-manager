'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

interface QuoteRow   { id: string; quote_number: string; total: number; status: string; created_at: string; client?: { name: string } | null }
interface InvoiceRow { id: string; invoice_number: string; total: number; status: string; created_at: string; paid_at?: string | null; client?: { name: string } | null }
interface ExpenseRow { id: string; description: string; amount: number; category?: string | null; date: string }

export default function SummaryPage() {
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth()) // 0-11
  const [loading, setLoading] = useState(true)

  const [quotes, setQuotes]     = useState<QuoteRow[]>([])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [paidInMonth, setPaidInMonth] = useState<InvoiceRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const start = new Date(year, month, 1).toISOString()
    const end   = new Date(year, month + 1, 1).toISOString()
    const startDate = start.slice(0, 10)
    const endDate   = end.slice(0, 10)

    const [q, inv, paid, exp] = await Promise.all([
      supabase.from('quotes').select('id,quote_number,total,status,created_at,client:clients(name)')
        .gte('created_at', start).lt('created_at', end).order('created_at', { ascending: false }),
      supabase.from('invoices').select('id,invoice_number,total,status,created_at,paid_at,client:clients(name)')
        .gte('created_at', start).lt('created_at', end).order('created_at', { ascending: false }),
      supabase.from('invoices').select('id,invoice_number,total,status,created_at,paid_at,client:clients(name)')
        .gte('paid_at', start).lt('paid_at', end),
      supabase.from('expenses').select('id,description,amount,category,date')
        .gte('date', startDate).lt('date', endDate).order('date', { ascending: false }),
    ])

    setQuotes((q.data as any) || [])
    setInvoices((inv.data as any) || [])
    setPaidInMonth((paid.data as any) || [])
    setExpenses((exp.data as any) || [])
    setLoading(false)
  }, [year, month])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const quoted    = quotes.reduce((s, q) => s + (q.total || 0), 0)
  const approved  = quotes.filter(q => q.status === 'approved')
  const approvedT = approved.reduce((s, q) => s + (q.total || 0), 0)
  const billed    = invoices.reduce((s, i) => s + (i.total || 0), 0)
  const collected = paidInMonth.reduce((s, i) => s + (i.total || 0), 0)
  const spent     = expenses.reduce((s, e) => s + (e.amount || 0), 0)
  const net       = Math.round((collected - spent) * 100) / 100

  const monthLabel = `${MONTHS[month]} ${year}`

  // Resumen en texto
  const summaryText = loading ? '' :
    `En ${monthLabel} se crearon ${quotes.length} quote${quotes.length === 1 ? '' : 's'} por ${formatCurrency(quoted)}` +
    (approved.length ? `, de las cuales ${approved.length} se aprobaron (${formatCurrency(approvedT)})` : '') +
    `. Se facturaron ${formatCurrency(billed)} y se cobraron ${formatCurrency(collected)}. ` +
    `Los gastos fueron ${formatCurrency(spent)}, dejando un neto de ${formatCurrency(net)}.`

  const card = "bg-white border border-gray-200 rounded-xl p-4"

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header + selector de mes */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">📊 Resumen Mensual</h1>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
            <span className="font-semibold text-gray-800 min-w-36 text-center">{monthLabel}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
          </div>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Cargando…</p>
        ) : (
          <>
            {/* Resumen escrito */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <p className="text-gray-800 leading-relaxed">{summaryText}</p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className={card}>
                <p className="text-xs text-gray-400 uppercase font-semibold">Cotizado</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(quoted)}</p>
                <p className="text-xs text-gray-500">{quotes.length} quotes</p>
              </div>
              <div className={card}>
                <p className="text-xs text-gray-400 uppercase font-semibold">Aprobado</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(approvedT)}</p>
                <p className="text-xs text-gray-500">{approved.length} quotes aprobadas</p>
              </div>
              <div className={card}>
                <p className="text-xs text-gray-400 uppercase font-semibold">Facturado</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{formatCurrency(billed)}</p>
                <p className="text-xs text-gray-500">{invoices.length} invoices</p>
              </div>
              <div className={card}>
                <p className="text-xs text-gray-400 uppercase font-semibold">Cobrado</p>
                <p className="text-2xl font-bold text-green-600 mt-1">{formatCurrency(collected)}</p>
                <p className="text-xs text-gray-500">{paidInMonth.length} pagos recibidos</p>
              </div>
              <div className={card}>
                <p className="text-xs text-gray-400 uppercase font-semibold">Gastos</p>
                <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(spent)}</p>
                <p className="text-xs text-gray-500">{expenses.length} gastos</p>
              </div>
              <div className={card}>
                <p className="text-xs text-gray-400 uppercase font-semibold">Neto (cobrado − gastos)</p>
                <p className={`text-2xl font-bold mt-1 ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatCurrency(net)}</p>
              </div>
            </div>

            {/* Listas */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className={card}>
                <p className="font-bold text-gray-800 mb-3">Quotes del mes</p>
                {quotes.length === 0 && <p className="text-sm text-gray-400">Sin quotes este mes</p>}
                {quotes.map(q => (
                  <div key={q.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600">{q.quote_number} · {q.client?.name || '—'}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                        q.status === 'approved' ? 'bg-green-100 text-green-700' :
                        q.status === 'sent' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>{q.status}</span>
                    </span>
                    <span className="font-medium text-gray-800">{formatCurrency(q.total)}</span>
                  </div>
                ))}
              </div>

              <div className={card}>
                <p className="font-bold text-gray-800 mb-3">Invoices del mes</p>
                {invoices.length === 0 && <p className="text-sm text-gray-400">Sin invoices este mes</p>}
                {invoices.map(i => (
                  <div key={i.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-600">{i.invoice_number} · {i.client?.name || '—'}
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                        i.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>{i.status}</span>
                    </span>
                    <span className="font-medium text-gray-800">{formatCurrency(i.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={card}>
              <p className="font-bold text-gray-800 mb-3">Gastos del mes</p>
              {expenses.length === 0 && <p className="text-sm text-gray-400">Sin gastos este mes</p>}
              {expenses.map(e => (
                <div key={e.id} className="flex justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">
                    {new Date(e.date + 'T12:00:00').toLocaleDateString('es-US', { day: 'numeric', month: 'short' })} · {e.description}
                    {e.category && <span className="ml-2 text-xs text-gray-400">({e.category})</span>}
                  </span>
                  <span className="font-medium text-red-500">−{formatCurrency(e.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
