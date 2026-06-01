'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { BarChart3, TrendingUp, TrendingDown, DollarSign, FileText, Users, Folder } from 'lucide-react'

interface ReportData {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalQuotes: number
  approvedQuotes: number
  conversionRate: number
  totalClients: number
  activeProjects: number
  completedProjects: number
  avgQuoteValue: number
  revenueByMonth: { month: string; revenue: number; expenses: number }[]
  topServices: { service: string; count: number; revenue: number }[]
  leadsByStatus: { status: string; count: number }[]
  quotesByStatus: { status: string; count: number; value: number }[]
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReports() }, [])

  async function loadReports() {
    setLoading(true)

    const [quotesRes, expensesRes, clientsRes, projectsRes, leadsRes] = await Promise.all([
      supabase.from('quotes').select('status, total, items, created_at'),
      supabase.from('expenses').select('amount, date, category'),
      supabase.from('clients').select('id', { count: 'exact' }),
      supabase.from('projects').select('status'),
      supabase.from('leads').select('status'),
    ])

    const quotes = quotesRes.data || []
    const expenses = expensesRes.data || []
    const leads = leadsRes.data || []
    const projects = projectsRes.data || []

    const approvedQuotes = quotes.filter(q => q.status === 'approved')
    const totalRevenue = approvedQuotes.reduce((s, q) => s + (q.total || 0), 0)
    const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0)

    // Revenue by month (last 6 months)
    const monthMap: Record<string, { revenue: number; expenses: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      monthMap[d.toISOString().slice(0, 7)] = { revenue: 0, expenses: 0 }
    }
    approvedQuotes.forEach(q => {
      const m = q.created_at?.slice(0, 7)
      if (m && monthMap[m]) monthMap[m].revenue += q.total || 0
    })
    expenses.forEach(e => {
      const m = e.date?.slice(0, 7)
      if (m && monthMap[m]) monthMap[m].expenses += e.amount || 0
    })

    const revenueByMonth = Object.entries(monthMap).map(([month, vals]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      ...vals
    }))

    // Top services from quote items
    const serviceMap: Record<string, { count: number; revenue: number }> = {}
    quotes.forEach(q => {
      if (!Array.isArray(q.items)) return
      q.items.forEach((item: any) => {
        if (!serviceMap[item.service_type]) serviceMap[item.service_type] = { count: 0, revenue: 0 }
        serviceMap[item.service_type].count += item.quantity || 1
        serviceMap[item.service_type].revenue += item.subtotal || 0
      })
    })
    const serviceLabels: Record<string, string> = {
      full_wrap: 'Full Wrap', partial_wrap: 'Partial Wrap', lettering: 'Lettering',
      fleet_graphics: 'Fleet Graphics', wall_mural: 'Wall Mural',
      window_graphics: 'Window Graphics', storefront_graphics: 'Storefront', interior_graphics: 'Interior'
    }
    const topServices = Object.entries(serviceMap)
      .map(([service, v]) => ({ service: serviceLabels[service] || service, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Leads by status
    const leadStatusMap: Record<string, number> = {}
    leads.forEach(l => { leadStatusMap[l.status] = (leadStatusMap[l.status] || 0) + 1 })
    const leadsByStatus = Object.entries(leadStatusMap).map(([status, count]) => ({ status, count }))

    // Quotes by status
    const quoteStatusMap: Record<string, { count: number; value: number }> = {}
    quotes.forEach(q => {
      if (!quoteStatusMap[q.status]) quoteStatusMap[q.status] = { count: 0, value: 0 }
      quoteStatusMap[q.status].count++
      quoteStatusMap[q.status].value += q.total || 0
    })
    const quotesByStatus = Object.entries(quoteStatusMap).map(([status, v]) => ({ status, ...v }))

    setData({
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      totalQuotes: quotes.length,
      approvedQuotes: approvedQuotes.length,
      conversionRate: quotes.length > 0 ? Math.round((approvedQuotes.length / quotes.length) * 100) : 0,
      totalClients: clientsRes.count || 0,
      activeProjects: projects.filter(p => !['completed', 'invoiced'].includes(p.status)).length,
      completedProjects: projects.filter(p => p.status === 'completed' || p.status === 'invoiced').length,
      avgQuoteValue: approvedQuotes.length > 0 ? Math.round(totalRevenue / approvedQuotes.length) : 0,
      revenueByMonth,
      topServices,
      leadsByStatus,
      quotesByStatus,
    })

    setLoading(false)
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Building reports...</div>
  if (!data) return null

  const maxMonthRevenue = Math.max(...data.revenueByMonth.map(m => Math.max(m.revenue, m.expenses, 1)))
  const maxServiceRevenue = Math.max(...data.topServices.map(s => s.revenue), 1)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-500 mt-1">Business overview — Infinity Wrap Design</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Revenue', value: formatCurrency(data.totalRevenue), color: 'text-green-600', icon: TrendingUp, iconColor: 'bg-green-100 text-green-600' },
            { label: 'Total Expenses', value: formatCurrency(data.totalExpenses), color: 'text-red-500', icon: TrendingDown, iconColor: 'bg-red-100 text-red-600' },
            { label: 'Net Profit', value: formatCurrency(data.netProfit), color: data.netProfit >= 0 ? 'text-orange-500' : 'text-red-600', icon: DollarSign, iconColor: data.netProfit >= 0 ? 'bg-orange-100 text-orange-600' : 'bg-red-100 text-red-600' },
            { label: 'Avg Quote Value', value: formatCurrency(data.avgQuoteValue), color: 'text-blue-600', icon: FileText, iconColor: 'bg-blue-100 text-blue-600' },
          ].map(kpi => {
            const Icon = kpi.icon
            return (
              <div key={kpi.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-gray-500 text-sm">{kpi.label}</p>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.iconColor}`}><Icon size={16} /></div>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Revenue vs Expenses Chart */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-5">Revenue vs Expenses (6 months)</h2>
            <div className="space-y-3">
              {data.revenueByMonth.map(m => (
                <div key={m.month}>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="font-medium">{m.month}</span>
                    <span>{formatCurrency(m.revenue)} <span className="text-gray-300">/ {formatCurrency(m.expenses)}</span></span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${(m.revenue / maxMonthRevenue) * 100}%` }} />
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full transition-all" style={{ width: `${(m.expenses / maxMonthRevenue) * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-4 pt-2">
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-2 bg-green-500 rounded-sm inline-block"></span>Revenue</span>
                <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-1.5 bg-red-400 rounded-sm inline-block"></span>Expenses</span>
              </div>
            </div>
          </div>

          {/* Top Services */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-5">Top Services by Revenue</h2>
            {data.topServices.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {data.topServices.map((s, i) => (
                  <div key={s.service}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-800">{s.service}</span>
                      <span className="text-gray-500">{formatCurrency(s.revenue)} · {s.count} unit{s.count !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(s.revenue / maxServiceRevenue) * 100}%`, background: ['#f97316','#3b82f6','#8b5cf6','#10b981','#f59e0b'][i] }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Quote Performance */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Quote Performance</h2>
            <div className="space-y-3">
              {[
                { label: 'Total Quotes', value: data.totalQuotes },
                { label: 'Approved', value: data.approvedQuotes, color: 'text-green-600' },
                { label: 'Conversion Rate', value: `${data.conversionRate}%`, color: data.conversionRate >= 50 ? 'text-green-600' : 'text-orange-500' },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{stat.label}</span>
                  <span className={`font-bold text-lg ${stat.color || 'text-gray-900'}`}>{stat.value}</span>
                </div>
              ))}
              {data.quotesByStatus.map(q => (
                <div key={q.status} className="flex justify-between items-center py-1">
                  <span className="text-xs text-gray-400 capitalize">{q.status}</span>
                  <span className="text-xs text-gray-600">{q.count} · {formatCurrency(q.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Projects */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Projects</h2>
            <div className="space-y-3">
              {[
                { label: 'Active', value: data.activeProjects, color: 'text-orange-500' },
                { label: 'Completed', value: data.completedProjects, color: 'text-green-600' },
                { label: 'Total Clients', value: data.totalClients, color: 'text-purple-600' },
              ].map(stat => (
                <div key={stat.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm text-gray-600">{stat.label}</span>
                  <span className={`font-bold text-2xl ${stat.color}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Leads Funnel */}
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Leads Funnel</h2>
            {data.leadsByStatus.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No leads tracked yet</p>
            ) : (
              <div className="space-y-2">
                {data.leadsByStatus.sort((a, b) => b.count - a.count).map(l => (
                  <div key={l.status} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600 capitalize">{l.status.replace('_', ' ')}</span>
                    <span className="font-bold text-gray-900">{l.count}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-bold">{data.leadsByStatus.reduce((s, l) => s + l.count, 0)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
