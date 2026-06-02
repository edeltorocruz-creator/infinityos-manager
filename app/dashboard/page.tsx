'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import {
  Phone, FileText, DollarSign, FolderOpen, Users, Target,
  Receipt, TrendingUp, TrendingDown, Zap, Plus, RefreshCw,
  ArrowRight, AlertTriangle, CheckCircle, Clock, Flame,
  Brain, Sparkles, ChevronRight
} from 'lucide-react'

// ── helpers ──
function daysSince(d: string | null) {
  if (!d) return 999
  return Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
}
function daysUntil(d: string | null) {
  if (!d) return 999
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}
function timeLabel(d: string) {
  const days = daysSince(d)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

interface DashData {
  // Action items
  leadsToContact:   any[]
  hotLeads:         any[]
  pendingQuotes:    any[]
  unpaidInvoices:   any[]
  activeProjects:   any[]
  topProspects:     any[]
  recentExpenses:   any[]
  // Numbers
  revenueCollected: number
  revenueThisMonth: number
  pipelineValue:    number
  outstandingAmount:number
  expensesThisMonth:number
  // Counts
  newLeadsCount:    number
  overdueInvoices:  number
}

export default function DashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiPlan, setAiPlan] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [quickLead, setQuickLead] = useState({ name: '', phone: '', service: '', value: '' })
  const [quickExpense, setQuickExpense] = useState({ description: '', amount: '', category: 'Materials' })
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [
      leadsRes, quotesRes, invoicesRes,
      projectsRes, prospectsRes, expensesRes, paidInvoicesRes
    ] = await Promise.all([
      supabase.from('leads').select('*').not('status', 'in', '("won","lost")').order('updated_at', { ascending: false }),
      supabase.from('quotes').select('*, client:clients(name,phone)').in('status', ['draft','sent']).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*, client:clients(name,phone)').not('status', 'in', '("paid","cancelled")').order('created_at', { ascending: false }),
      supabase.from('projects').select('*, client:clients(name)').not('status', 'in', '("completed","invoiced")').order('created_at', { ascending: false }),
      supabase.from('prospects').select('*').eq('status', 'new').eq('priority', 'high').limit(4),
      supabase.from('expenses').select('*').gte('date', monthStart).order('date', { ascending: false }).limit(5),
      supabase.from('invoices').select('total, created_at').eq('status', 'paid'),
    ])

    const leads = leadsRes.data || []
    const quotes = quotesRes.data || []
    const invoices = invoicesRes.data || []
    const projects = projectsRes.data || []
    const prospects = prospectsRes.data || []
    const expenses = expensesRes.data || []
    const paidInvoices = paidInvoicesRes.data || []

    // Revenue calculations
    const revenueCollected = paidInvoices.reduce((s, i) => s + i.total, 0)
    const revenueThisMonth = paidInvoices
      .filter(i => i.created_at >= monthStart)
      .reduce((s, i) => s + i.total, 0)
    const pipelineValue = leads.reduce((s, l) => s + (l.estimated_value || 0), 0)
      + quotes.reduce((s, q) => s + (q.total || 0), 0)
    const outstandingAmount = invoices.reduce((s, i) => s + (i.balance_due || 0), 0)
    const expensesThisMonth = expenses.reduce((s, e) => s + e.amount, 0)

    // Leads needing contact (sorted by urgency)
    const leadsToContact = leads
      .map(l => ({ ...l, _days: daysSince(l.last_contacted_at || l.created_at) }))
      .filter(l => l._days >= 2)
      .sort((a, b) => b._days - a._days)
      .slice(0, 5)

    const hotLeads = leads.filter(l =>
      daysSince(l.last_contacted_at || l.created_at) <= 2 &&
      ['negotiating', 'quoted'].includes(l.status)
    ).slice(0, 3)

    setData({
      leadsToContact, hotLeads,
      pendingQuotes: quotes.slice(0, 4),
      unpaidInvoices: invoices.slice(0, 4),
      activeProjects: projects.slice(0, 4),
      topProspects: prospects.slice(0, 3),
      recentExpenses: expenses.slice(0, 4),
      revenueCollected, revenueThisMonth, pipelineValue,
      outstandingAmount, expensesThisMonth,
      newLeadsCount: leads.filter(l => l.status === 'new').length,
      overdueInvoices: invoices.filter(i => i.status === 'overdue').length,
    })
    setLoading(false)
  }

  async function getAIPlan() {
    if (!data) return
    setLoadingPlan(true)
    setAiPlan(null)
    const ctx = [
      `Leads to contact today: ${data.leadsToContact.length} (${data.leadsToContact.map(l => `${l.name} - ${l._days}d silent`).join(', ')})`,
      `Hot leads closing: ${data.hotLeads.map(l => l.name).join(', ') || 'none'}`,
      `Pending quotes: ${data.pendingQuotes.length} worth ${formatCurrency(data.pendingQuotes.reduce((s, q) => s + q.total, 0))}`,
      `Unpaid invoices: ${data.unpaidInvoices.length} — outstanding ${formatCurrency(data.outstandingAmount)}`,
      `Active projects: ${data.activeProjects.length}`,
      `Pipeline value: ${formatCurrency(data.pipelineValue)}`,
      `Revenue this month: ${formatCurrency(data.revenueThisMonth)}`,
      `Overdue invoices: ${data.overdueInvoices}`,
    ].join('\n')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 800,
          system: `You are Infinity Manager IA, the operations brain for Infinity Wrap Design — a vehicle wrap and graphics company in North Carolina. You look at today's data and give the owner a crisp, numbered action plan for the day. Be direct, specific, use first names when available. Prioritize money-generating actions first. Max 8 actions. Format as numbered list only.`,
          messages: [{
            role: 'user',
            content: `Today is ${today}. Here's the business status:\n\n${ctx}\n\nGive me my top action items for today to maximize revenue. Be specific — names, amounts, what to say.`
          }]
        })
      })
      const d = await res.json()
      setAiPlan(d.content?.find((c: any) => c.type === 'text')?.text || 'Could not generate plan.')
    } catch { setAiPlan('Connection error. Check and retry.') }
    setLoadingPlan(false)
  }

  async function saveQuickLead() {
    if (!quickLead.name.trim()) return
    setSaving(true)
    await supabase.from('leads').insert({
      name: quickLead.name, phone: quickLead.phone || null,
      service_interest: quickLead.service || null,
      estimated_value: quickLead.value ? parseFloat(quickLead.value) : null,
      status: 'new', updated_at: new Date().toISOString(),
    })
    setSaving(false); setShowLeadModal(false)
    setQuickLead({ name: '', phone: '', service: '', value: '' })
    loadAll()
  }

  async function saveQuickExpense() {
    if (!quickExpense.description || !quickExpense.amount) return
    setSaving(true)
    await supabase.from('expenses').insert({
      description: quickExpense.description, amount: parseFloat(quickExpense.amount),
      category: quickExpense.category, date: new Date().toISOString().split('T')[0],
    })
    setSaving(false); setShowExpenseModal(false)
    setQuickExpense({ description: '', amount: '', category: 'Materials' })
    loadAll()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Brain size={40} className="text-orange-500 animate-pulse mx-auto mb-3"/>
        <p className="text-gray-400 font-medium">Loading your day...</p>
      </div>
    </div>
  )

  const d = data!

  // Compute today's priority score
  const urgentCount = d.leadsToContact.length + d.overdueInvoices + (d.pendingQuotes.filter(q => {
    const exp = q.expires_at ? daysUntil(q.expires_at) : 999
    return exp <= 3
  }).length)

  return (
    <div className="min-h-screen bg-gray-50 p-5">
      <div className="max-w-7xl mx-auto">

        {/* ── TOP HEADER ── */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-gray-400 text-sm">{greeting} · {today}</p>
            <h1 className="text-2xl font-black text-gray-900 mt-0.5">
              {urgentCount > 0
                ? <span className="flex items-center gap-2"><Flame size={22} className="text-red-500"/>{urgentCount} actions need your attention</span>
                : <span className="flex items-center gap-2"><CheckCircle size={22} className="text-green-500"/>You're on top of it 👊</span>
              }
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadAll} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400 transition-colors"><RefreshCw size={16}/></button>
            <button onClick={getAIPlan} disabled={loadingPlan}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              {loadingPlan ? <Sparkles size={14} className="animate-pulse text-orange-400"/> : <Brain size={14} className="text-orange-400"/>}
              {loadingPlan ? 'Thinking...' : 'Daily Plan'}
            </button>
          </div>
        </div>

        {/* ── AI DAILY PLAN ── */}
        {aiPlan && (
          <div className="bg-gray-900 text-white rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-orange-400"/>
              <span className="text-orange-400 font-bold text-sm uppercase tracking-wide">Infinity Manager IA — Your Plan for Today</span>
            </div>
            <div className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{aiPlan}</div>
            <button onClick={() => setAiPlan(null)} className="mt-3 text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
          </div>
        )}

        {/* ── QUICK ACTIONS ── */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
          {[
            { label: 'Add Lead',       icon: Users,       color: 'bg-blue-500',   action: () => setShowLeadModal(true) },
            { label: 'New Quote',      icon: FileText,    color: 'bg-orange-500', action: () => router.push('/quotes/new') },
            { label: 'Add Expense',    icon: Receipt,     color: 'bg-red-500',    action: () => setShowExpenseModal(true) },
            { label: 'Follow-up',      icon: Phone,       color: 'bg-green-500',  action: () => router.push('/followup') },
            { label: 'New Invoice',    icon: DollarSign,  color: 'bg-purple-500', action: () => router.push('/quotes') },
            { label: 'Prospects',      icon: Target,      color: 'bg-gray-700',   action: () => router.push('/prospects') },
          ].map(btn => (
            <button key={btn.label} onClick={btn.action}
              className={`${btn.color} hover:opacity-90 text-white rounded-xl py-3 px-2 flex flex-col items-center gap-1.5 transition-opacity`}>
              <btn.icon size={18}/>
              <span className="text-xs font-semibold leading-tight text-center">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* ── REVENUE ROW ── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Collected (total)', value: formatCurrency(d.revenueCollected), color: 'text-green-600', sub: 'all time' },
            { label: 'This month',        value: formatCurrency(d.revenueThisMonth),  color: 'text-green-500', sub: 'revenue' },
            { label: 'Outstanding',       value: formatCurrency(d.outstandingAmount), color: 'text-orange-500', sub: 'to collect' },
            { label: 'Pipeline',          value: formatCurrency(d.pipelineValue),     color: 'text-blue-600',   sub: 'potential' },
            { label: 'Expenses (month)',  value: formatCurrency(d.expensesThisMonth), color: 'text-red-500',    sub: 'spent' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs">{s.label}</p>
              <p className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value}</p>
              <p className="text-gray-300 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── MAIN ACTION GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

          {/* 1. CONTACTAR HOY */}
          <ActionCard
            title="Contactar Hoy"
            icon={<Phone size={16} className="text-red-500"/>}
            count={d.leadsToContact.length}
            urgent={d.leadsToContact.length > 0}
            href="/followup"
            cta="Ver todos →"
            emptyText="No hay leads pendientes de contacto"
          >
            {d.leadsToContact.slice(0, 3).map(lead => (
              <div key={lead.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${lead._days >= 14 ? 'bg-red-500' : lead._days >= 7 ? 'bg-orange-400' : 'bg-yellow-400'}`}/>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                    <p className="text-xs text-gray-400">{lead.service_interest || lead.status} · {lead._days}d sin contacto</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {lead.estimated_value && <span className="text-xs font-bold text-orange-500">{formatCurrency(lead.estimated_value)}</span>}
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors">
                      <Phone size={12}/>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </ActionCard>

          {/* 2. HOT LEADS + QUOTES PENDIENTES */}
          <ActionCard
            title="Quotes Pendientes"
            icon={<FileText size={16} className="text-blue-500"/>}
            count={d.pendingQuotes.length}
            urgent={false}
            href="/quotes"
            cta="Ver todos →"
            emptyText="No hay quotes pendientes"
          >
            {d.pendingQuotes.slice(0, 3).map(q => {
              const expDays = q.expires_at ? daysUntil(q.expires_at) : null
              return (
                <div key={q.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg"
                  onClick={() => router.push(`/quotes/${q.id}`)}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{q.client?.name || 'No client'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${q.status === 'sent' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>{q.status}</span>
                      {expDays !== null && expDays <= 5 && <span className="text-xs text-red-500 font-medium">⚠ Expires in {expDays}d</span>}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-gray-900 flex-shrink-0 ml-2">{formatCurrency(q.total)}</span>
                </div>
              )
            })}
          </ActionCard>

          {/* 3. INVOICES POR COBRAR */}
          <ActionCard
            title="Invoices por Cobrar"
            icon={<DollarSign size={16} className="text-orange-500"/>}
            count={d.unpaidInvoices.length}
            urgent={d.overdueInvoices > 0}
            href="/invoices"
            cta="Ver todos →"
            emptyText="No hay invoices pendientes"
            badge={d.overdueInvoices > 0 ? `${d.overdueInvoices} OVERDUE` : undefined}
          >
            {d.unpaidInvoices.slice(0, 3).map(inv => (
              <div key={inv.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg"
                onClick={() => router.push(`/invoices/${inv.id}`)}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{inv.client?.name || '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${inv.status === 'overdue' ? 'bg-red-100 text-red-600' : inv.status === 'deposit_paid' ? 'bg-orange-50 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                      {inv.status === 'deposit_paid' ? 'Dep ✓' : inv.status}
                    </span>
                    {inv.client?.phone && (
                      <a href={`tel:${inv.client.phone}`} onClick={e => e.stopPropagation()}
                        className="text-xs text-gray-400 hover:text-green-600 flex items-center gap-1">
                        <Phone size={10}/>call
                      </a>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-sm font-bold text-orange-500">{formatCurrency(inv.balance_due)}</p>
                  <p className="text-xs text-gray-400">of {formatCurrency(inv.total)}</p>
                </div>
              </div>
            ))}
          </ActionCard>

          {/* 4. PROYECTOS ACTIVOS */}
          <ActionCard
            title="Proyectos Activos"
            icon={<FolderOpen size={16} className="text-purple-500"/>}
            count={d.activeProjects.length}
            urgent={false}
            href="/projects"
            cta="Ver todos →"
            emptyText="No hay proyectos activos"
          >
            {d.activeProjects.slice(0, 3).map(proj => {
              const statusColors: Record<string, string> = {
                quoted: 'bg-gray-100 text-gray-600',
                deposit_paid: 'bg-blue-100 text-blue-700',
                in_production: 'bg-purple-100 text-purple-700',
                installation: 'bg-orange-100 text-orange-700',
              }
              return (
                <div key={proj.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-1 px-1 rounded-lg"
                  onClick={() => router.push('/projects')}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{proj.name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${statusColors[proj.status] || 'bg-gray-100 text-gray-500'}`}>
                      {proj.status.replace('_', ' ')}
                    </span>
                  </div>
                  {proj.total_amount && <span className="text-sm font-bold text-gray-700 flex-shrink-0 ml-2">{formatCurrency(proj.total_amount)}</span>}
                </div>
              )
            })}
          </ActionCard>

          {/* 5. LEADS CALIENTES */}
          {(d.hotLeads.length > 0 || d.newLeadsCount > 0) && (
            <ActionCard
              title="Leads Calientes"
              icon={<Flame size={16} className="text-orange-500"/>}
              count={d.hotLeads.length}
              urgent={d.hotLeads.length > 0}
              href="/leads"
              cta="Ver leads →"
              emptyText="Sin leads calientes ahora"
            >
              {d.hotLeads.map(lead => (
                <div key={lead.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0"/>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{lead.name}</p>
                      <p className="text-xs text-gray-400 capitalize">{lead.status} · {lead.service_interest || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {lead.estimated_value && <span className="text-xs font-bold text-green-600">{formatCurrency(lead.estimated_value)}</span>}
                    {lead.phone && <a href={`tel:${lead.phone}`} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg"><Phone size={12}/></a>}
                  </div>
                </div>
              ))}
              {d.newLeadsCount > 0 && (
                <div className="pt-2 mt-1">
                  <button onClick={() => router.push('/leads')} className="text-xs text-blue-600 font-semibold hover:text-blue-800">
                    + {d.newLeadsCount} new leads not yet contacted →
                  </button>
                </div>
              )}
            </ActionCard>
          )}

          {/* 6. PROSPECTOS RECOMENDADOS */}
          {d.topProspects.length > 0 && (
            <ActionCard
              title="Prospectos Recomendados"
              icon={<Target size={16} className="text-gray-600"/>}
              count={d.topProspects.length}
              urgent={false}
              href="/prospects"
              cta="Ver todos →"
              emptyText="Sin prospectos activos"
            >
              {d.topProspects.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.company_name || p.business_type}</p>
                    <p className="text-xs text-gray-400">{p.business_type} · {p.location || 'NC'}</p>
                  </div>
                  <span className="text-xs font-bold text-orange-500 flex-shrink-0 ml-2">{formatCurrency(p.estimated_value)}</span>
                </div>
              ))}
            </ActionCard>
          )}
        </div>

        {/* ── GASTOS RECIENTES ── */}
        {d.recentExpenses.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={16} className="text-red-500"/>
                Gastos Recientes
                <span className="text-gray-400 text-sm font-normal">({new Date().toLocaleString('en-US', { month: 'long' })})</span>
              </p>
              <button onClick={() => router.push('/expenses')} className="text-xs text-orange-500 font-semibold hover:text-orange-700 flex items-center gap-1">
                Ver todos <ChevronRight size={12}/>
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {d.recentExpenses.map(e => (
                <div key={e.id} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 mb-0.5">{e.category}</p>
                  <p className="font-bold text-red-500">{formatCurrency(e.amount)}</p>
                  <p className="text-xs text-gray-600 truncate mt-0.5">{e.description}</p>
                  <p className="text-xs text-gray-300">{timeLabel(e.date)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── NET SUMMARY ── */}
        <div className="bg-gray-900 rounded-2xl p-5 text-white">
          <p className="text-xs font-bold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2"><TrendingUp size={12}/>Resumen del Mes</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-gray-400 text-xs">Ingresó</p>
              <p className="text-2xl font-black text-green-400">{formatCurrency(d.revenueThisMonth)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Gastado</p>
              <p className="text-2xl font-black text-red-400">{formatCurrency(d.expensesThisMonth)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Neto</p>
              <p className={`text-2xl font-black ${d.revenueThisMonth - d.expensesThisMonth >= 0 ? 'text-white' : 'text-red-400'}`}>
                {formatCurrency(d.revenueThisMonth - d.expensesThisMonth)}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-gray-400 text-xs">Por cobrar: <span className="text-orange-400 font-bold">{formatCurrency(d.outstandingAmount)}</span></p>
            <p className="text-gray-400 text-xs">Pipeline: <span className="text-blue-400 font-bold">{formatCurrency(d.pipelineValue)}</span></p>
          </div>
        </div>

      </div>

      {/* ── QUICK ADD LEAD MODAL ── */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Users size={18} className="text-blue-500"/>Quick Add Lead</h2>
            <div className="space-y-3">
              {[
                { label: 'Name *', key: 'name', placeholder: 'Full name', type: 'text' },
                { label: 'Phone', key: 'phone', placeholder: '(919) 000-0000', type: 'tel' },
                { label: 'Service Interest', key: 'service', placeholder: 'Full Wrap, Fleet...', type: 'text' },
                { label: 'Estimated Value ($)', key: 'value', placeholder: '0.00', type: 'number' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                  <input type={f.type} value={(quickLead as any)[f.key]}
                    onChange={e => setQuickLead({ ...quickLead, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowLeadModal(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium">Cancel</button>
              <button onClick={saveQuickLead} disabled={saving || !quickLead.name.trim()}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold">
                {saving ? 'Saving...' : 'Add Lead'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK ADD EXPENSE MODAL ── */}
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

// ── Reusable ActionCard component ──
function ActionCard({
  title, icon, count, urgent, href, cta, emptyText, badge, children
}: {
  title: string; icon: React.ReactNode; count: number; urgent: boolean
  href: string; cta: string; emptyText: string; badge?: string; children?: React.ReactNode
}) {
  const router = useRouter()
  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-5 ${urgent ? 'border-red-200' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-gray-900">{title}</span>
          {count > 0 && (
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${urgent ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
              {count}
            </span>
          )}
          {badge && <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">{badge}</span>}
        </div>
        <button onClick={() => router.push(href)} className="text-xs text-orange-500 hover:text-orange-700 font-semibold flex items-center gap-1">
          {cta}<ChevronRight size={12}/>
        </button>
      </div>
      {count === 0
        ? <p className="text-gray-400 text-sm text-center py-4">{emptyText}</p>
        : <div>{children}</div>
      }
    </div>
  )
}
