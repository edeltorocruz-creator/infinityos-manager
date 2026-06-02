'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import {
  Plus, Search, Phone, Mail, Target, Edit2, Trash2,
  Zap, TrendingUp, Clock, AlertTriangle, Star, ChevronRight,
  FileText, UserCheck, Brain
} from 'lucide-react'

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost'

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string; ring: string }> = {
  new:         { label: 'New',         color: 'text-blue-700',   bg: 'bg-blue-50',    ring: 'ring-blue-200' },
  contacted:   { label: 'Contacted',   color: 'text-purple-700', bg: 'bg-purple-50',  ring: 'ring-purple-200' },
  quoted:      { label: 'Quoted',      color: 'text-orange-700', bg: 'bg-orange-50',  ring: 'ring-orange-200' },
  negotiating: { label: 'Negotiating', color: 'text-yellow-700', bg: 'bg-yellow-50',  ring: 'ring-yellow-200' },
  won:         { label: 'Won',         color: 'text-green-700',  bg: 'bg-green-50',   ring: 'ring-green-200' },
  lost:        { label: 'Lost',        color: 'text-red-700',    bg: 'bg-red-50',     ring: 'ring-red-200' },
}
const STAGES: LeadStatus[] = ['new', 'contacted', 'quoted', 'negotiating', 'won', 'lost']

interface Lead {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  service_interest: string | null
  status: LeadStatus
  estimated_value: number | null
  notes: string | null
  source: string | null
  created_at: string
  updated_at: string
}

// ── Intelligence engine (runs client-side, no external API needed) ──
function scoreLead(lead: Lead, quotes: any[]): {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  daysSinceContact: number
  urgency: 'hot' | 'warm' | 'cold' | 'stale'
  actions: string[]
  insight: string
} {
  const now = Date.now()
  const created = new Date(lead.created_at).getTime()
  const updated = new Date(lead.updated_at || lead.created_at).getTime()
  const daysSinceUpdate = Math.floor((now - updated) / 86400000)
  const daysSinceCreated = Math.floor((now - created) / 86400000)
  const daysSinceContact = daysSinceUpdate

  let score = 50
  const actions: string[] = []

  // Value weight
  const val = lead.estimated_value || 0
  if (val >= 5000) score += 20
  else if (val >= 2000) score += 12
  else if (val >= 500) score += 6

  // Status progression
  const statusPoints: Record<LeadStatus, number> = {
    new: 0, contacted: 10, quoted: 18, negotiating: 25, won: 0, lost: -40
  }
  score += statusPoints[lead.status]

  // Recency — freshness decays fast in wrap biz
  if (daysSinceContact <= 1) score += 15
  else if (daysSinceContact <= 3) score += 8
  else if (daysSinceContact <= 7) score += 0
  else if (daysSinceContact <= 14) score -= 10
  else if (daysSinceContact <= 30) score -= 20
  else score -= 35

  // Has contact info
  if (lead.phone) score += 5
  if (lead.email) score += 5

  // Has quote
  const hasQuote = quotes.some(q => q.notes?.includes(lead.name) || false)
  if (hasQuote) score += 8

  score = Math.max(0, Math.min(100, score))

  // Grade
  const grade = score >= 75 ? 'A' : score >= 55 ? 'B' : score >= 35 ? 'C' : 'D'

  // Urgency
  let urgency: 'hot' | 'warm' | 'cold' | 'stale' = 'cold'
  if (daysSinceContact <= 2 && lead.status !== 'lost') urgency = 'hot'
  else if (daysSinceContact <= 7 && lead.status !== 'lost') urgency = 'warm'
  else if (daysSinceContact > 21 || lead.status === 'lost') urgency = 'stale'

  // Smart action suggestions
  if (lead.status === 'new' && daysSinceCreated >= 1) {
    actions.push(`Call ${lead.name} — new lead, hasn't been contacted yet`)
  }
  if (lead.status === 'contacted' && daysSinceContact >= 3) {
    actions.push(`Follow up with ${lead.name} — ${daysSinceContact}d since last contact`)
  }
  if (lead.status === 'quoted' && daysSinceContact >= 5) {
    actions.push(`Check in on quote — ${lead.name} hasn't responded in ${daysSinceContact}d`)
  }
  if (lead.status === 'negotiating' && daysSinceContact >= 2) {
    actions.push(`Close ${lead.name} — in negotiation for ${daysSinceContact}d, act now`)
  }
  if (lead.status === 'new' && daysSinceCreated >= 7) {
    actions.push(`Re-engage or mark lost — ${lead.name} has been sitting for ${daysSinceCreated}d`)
  }

  // Insight text
  let insight = ''
  if (lead.status === 'negotiating') insight = 'In negotiation — highest close probability. Follow up within 24h.'
  else if (lead.status === 'quoted' && daysSinceContact <= 3) insight = 'Quote sent recently. Good time to check in with a phone call.'
  else if (lead.status === 'quoted' && daysSinceContact > 7) insight = 'Quote aging. Consider offering a discount or expiration reminder.'
  else if (lead.status === 'contacted' && daysSinceContact <= 2) insight = 'Recently contacted. Schedule a quote walkthrough.'
  else if (lead.status === 'new' && daysSinceCreated <= 1) insight = 'Fresh lead. Contact within 24h — response rates drop 80% after day 1.'
  else if (lead.status === 'new' && daysSinceCreated > 3) insight = 'New lead going cold. Contact today or it may be lost.'
  else if (lead.status === 'lost') insight = 'Marked lost. Consider a win-back in 30–60 days.'
  else insight = `${daysSinceContact}d since last activity.`

  return { score, grade, daysSinceContact, urgency, actions, insight }
}

const URGENCY_STYLE = {
  hot:   { dot: 'bg-red-500 animate-pulse', label: 'Hot', text: 'text-red-600', badge: 'bg-red-50 text-red-700' },
  warm:  { dot: 'bg-orange-400', label: 'Warm', text: 'text-orange-600', badge: 'bg-orange-50 text-orange-700' },
  cold:  { dot: 'bg-blue-400', label: 'Cold', text: 'text-blue-600', badge: 'bg-blue-50 text-blue-700' },
  stale: { dot: 'bg-gray-300', label: 'Stale', text: 'text-gray-400', badge: 'bg-gray-50 text-gray-500' },
}

const GRADE_STYLE = {
  A: 'bg-green-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-yellow-500 text-white',
  D: 'bg-gray-400 text-white',
}

const EMPTY_FORM = {
  name: '', company: '', email: '', phone: '',
  service_interest: '', status: 'new' as LeadStatus,
  estimated_value: '', notes: '', source: ''
}

type ViewMode = 'intelligence' | 'pipeline' | 'list'

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [quotes, setQuotes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [viewMode, setViewMode] = useState<ViewMode>('intelligence')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [loadingAI, setLoadingAI] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('leads').select('*').order('updated_at', { ascending: false }),
      supabase.from('quotes').select('id, notes, status, total, created_at')
    ]).then(([lr, qr]) => {
      if (lr.data) setLeads(lr.data as Lead[])
      if (qr.data) setQuotes(qr.data)
      setLoading(false)
    })
  }, [])

  // Scored leads (memoized)
  const scoredLeads = useMemo(() =>
    leads.map(l => ({ ...l, intel: scoreLead(l, quotes) }))
  , [leads, quotes])

  const filtered = useMemo(() => {
    return scoredLeads.filter(l => {
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
        (l.company || '').toLowerCase().includes(search.toLowerCase()) ||
        (l.service_interest || '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = filterStatus === 'all' || l.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [scoredLeads, search, filterStatus])

  // Priority sorted for intelligence view
  const prioritized = useMemo(() =>
    [...filtered].sort((a, b) => b.intel.score - a.intel.score)
  , [filtered])

  const stats = useMemo(() => ({
    total: leads.length,
    active: leads.filter(l => !['won','lost'].includes(l.status)).length,
    won: leads.filter(l => l.status === 'won').length,
    pipeline: leads.filter(l => !['won','lost'].includes(l.status))
      .reduce((s, l) => s + (l.estimated_value || 0), 0),
    hotLeads: scoredLeads.filter(l => l.intel.urgency === 'hot' && l.status !== 'won').length,
    needsAction: scoredLeads.filter(l => l.intel.actions.length > 0 && !['won','lost'].includes(l.status)).length,
    conversionRate: leads.length > 0
      ? Math.round((leads.filter(l => l.status === 'won').length / leads.length) * 100)
      : 0,
  }), [leads, scoredLeads])

  // Global AI insight
  async function getAIBriefing() {
    setLoadingAI(true)
    setAiInsight(null)
    const topLeads = prioritized.slice(0, 8).filter(l => !['won','lost'].includes(l.status))
    const summary = topLeads.map(l =>
      `${l.name} (${l.company || 'no company'}) — status: ${l.status}, value: $${l.estimated_value || 0}, days since activity: ${l.intel.daysSinceContact}, score: ${l.intel.score}/100`
    ).join('\n')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are Infinity Manager IA, the sales intelligence engine for Infinity Wrap Design — a vehicle wrap, mural, and graphics company in North Carolina. You analyze the lead pipeline and give the owner a sharp, actionable morning briefing. Be direct, specific, use first names, prioritize by revenue potential. No fluff. Format as 3–5 bullet points max. Each bullet = one clear action.`,
          messages: [{
            role: 'user',
            content: `Today's lead pipeline for Infinity Wrap Design. Give me my priority actions for today:\n\n${summary}\n\nTotal pipeline: $${stats.pipeline.toLocaleString()}, ${stats.hotLeads} hot leads, ${stats.needsAction} need action.`
          }]
        })
      })
      const data = await res.json()
      const text = data.content?.find((c: any) => c.type === 'text')?.text || 'No response'
      setAiInsight(text)
    } catch {
      setAiInsight('Could not connect to AI. Check your connection.')
    }
    setLoadingAI(false)
  }

  function openNew() { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }
  function openEdit(l: Lead) {
    setEditing(l)
    setForm({
      name: l.name, company: l.company || '', email: l.email || '',
      phone: l.phone || '', service_interest: l.service_interest || '',
      status: l.status, estimated_value: l.estimated_value?.toString() || '',
      notes: l.notes || '', source: l.source || ''
    })
    setShowForm(true)
  }

  async function saveLead() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload = {
      name: form.name, company: form.company || null, email: form.email || null,
      phone: form.phone || null, service_interest: form.service_interest || null,
      status: form.status,
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      notes: form.notes || null, source: form.source || null,
      updated_at: new Date().toISOString()
    }
    if (editing) {
      await supabase.from('leads').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('leads').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    const { data } = await supabase.from('leads').select('*').order('updated_at', { ascending: false })
    if (data) setLeads(data as Lead[])
  }

  async function updateStatus(id: string, status: LeadStatus) {
    await supabase.from('leads').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setLeads(leads.map(l => l.id === id ? { ...l, status, updated_at: new Date().toISOString() } : l))
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    setLeads(leads.filter(l => l.id !== id))
  }

  async function convertToClient(lead: Lead) {
    setConvertingId(lead.id)
    const { data: newClient } = await supabase.from('clients').insert({
      name: lead.name, email: lead.email, phone: lead.phone, company: lead.company,
      notes: `Converted from lead. Service: ${lead.service_interest || 'N/A'}. Source: ${lead.source || 'N/A'}.`
    }).select().single()
    await supabase.from('leads').update({ status: 'won', updated_at: new Date().toISOString() }).eq('id', lead.id)
    setLeads(leads.map(l => l.id === lead.id ? { ...l, status: 'won' } : l))
    setConvertingId(null)
    if (newClient) router.push(`/quotes/new?clientId=${newClient.id}`)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading lead intelligence...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Brain size={28} className="text-orange-500" /> Lead Intelligence
            </h1>
            <p className="text-gray-500 mt-1">AI-powered pipeline — Infinity Wrap Design</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={getAIBriefing} disabled={loadingAI}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors">
              <Zap size={15}/>{loadingAI ? 'Analyzing...' : 'AI Briefing'}
            </button>
            <button onClick={openNew}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors">
              <Plus size={18}/> New Lead
            </button>
          </div>
        </div>

        {/* AI Briefing Panel */}
        {aiInsight && (
          <div className="mb-6 bg-gray-900 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <Brain size={16} className="text-orange-400"/>
              <span className="text-orange-400 font-bold text-sm uppercase tracking-wide">Infinity Manager IA — Today's Briefing</span>
            </div>
            <div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{aiInsight}</div>
            <button onClick={() => setAiInsight(null)} className="mt-3 text-xs text-gray-500 hover:text-gray-300">Dismiss</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900', sub: 'leads' },
            { label: 'Active', value: stats.active, color: 'text-blue-600', sub: 'in pipeline' },
            { label: 'Hot', value: stats.hotLeads, color: 'text-red-600', sub: 'need contact' },
            { label: 'Need Action', value: stats.needsAction, color: 'text-orange-500', sub: 'follow-ups' },
            { label: 'Won', value: stats.won, color: 'text-green-600', sub: 'converted' },
            { label: 'Close Rate', value: `${stats.conversionRate}%`, color: 'text-purple-600', sub: 'conversion' },
            { label: 'Pipeline', value: formatCurrency(stats.pipeline), color: 'text-orange-500', sub: 'est. revenue' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-xs">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* View tabs + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
            {([['intelligence','Intelligence'], ['pipeline','Pipeline'], ['list','List']] as [ViewMode,string][]).map(([v, label]) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['all', ...STAGES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                {s === 'all' ? 'All' : STATUS_CONFIG[s as LeadStatus]?.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── INTELLIGENCE VIEW ── */}
        {viewMode === 'intelligence' && (
          <div className="space-y-3">
            {prioritized.filter(l => !['won','lost'].includes(l.status)).length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                <Target size={40} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-gray-500">No active leads. Add your first lead to get started.</p>
              </div>
            )}
            {prioritized.filter(l => !['won','lost'].includes(l.status)).map(lead => {
              const { intel } = lead
              const urgencyStyle = URGENCY_STYLE[intel.urgency]
              const isConverting = convertingId === lead.id
              return (
                <div key={lead.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 ${intel.urgency === 'hot' ? 'border-red-200' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-4">
                    {/* Score badge */}
                    <div className="flex-shrink-0 text-center">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${GRADE_STYLE[intel.grade]}`}>
                        {intel.grade}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{intel.score}/100</p>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-gray-900">{lead.name}</h3>
                        <span className={`w-2 h-2 rounded-full ${urgencyStyle.dot}`}/>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${urgencyStyle.badge}`}>{urgencyStyle.label}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].color}`}>
                          {STATUS_CONFIG[lead.status].label}
                        </span>
                        {lead.source && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{lead.source}</span>}
                      </div>
                      {lead.company && <p className="text-gray-500 text-sm">{lead.company}</p>}
                      <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                        {lead.service_interest && <span className="text-orange-600 font-medium">{lead.service_interest}</span>}
                        {lead.phone && <span className="flex items-center gap-1"><Phone size={11}/>{lead.phone}</span>}
                        {lead.email && <span className="flex items-center gap-1"><Mail size={11}/>{lead.email}</span>}
                        <span className="flex items-center gap-1"><Clock size={11}/>{intel.daysSinceContact}d ago</span>
                      </div>

                      {/* AI Insight */}
                      <div className="mt-2 flex items-start gap-1.5">
                        <Zap size={12} className="text-orange-400 mt-0.5 flex-shrink-0"/>
                        <p className="text-xs text-gray-500 italic">{intel.insight}</p>
                      </div>

                      {/* Action suggestions */}
                      {intel.actions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {intel.actions.map((a, i) => (
                            <div key={i} className="flex items-start gap-1.5 bg-orange-50 rounded-lg px-2.5 py-1.5">
                              <AlertTriangle size={11} className="text-orange-500 mt-0.5 flex-shrink-0"/>
                              <p className="text-xs text-orange-700 font-medium">{a}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right column */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-3">
                      {lead.estimated_value && (
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(lead.estimated_value)}</p>
                          <p className="text-gray-400 text-xs">est. value</p>
                        </div>
                      )}
                      <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white cursor-pointer">
                        {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                      </select>
                      <div className="flex gap-1.5">
                        <button onClick={() => convertToClient(lead)} disabled={isConverting}
                          title="Convert to client + open quote"
                          className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-semibold transition-colors">
                          <UserCheck size={13}/>{isConverting ? '...' : 'Quote'}
                        </button>
                        <button onClick={() => openEdit(lead)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit2 size={14}/></button>
                        <button onClick={() => deleteLead(lead.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Won / Lost collapsed section */}
            {prioritized.filter(l => ['won','lost'].includes(l.status)).length > 0 && (
              <details className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <summary className="px-5 py-4 cursor-pointer text-sm font-semibold text-gray-500 hover:text-gray-700 select-none">
                  Closed leads ({prioritized.filter(l => ['won','lost'].includes(l.status)).length})
                </summary>
                <div className="px-5 pb-4 space-y-2">
                  {prioritized.filter(l => ['won','lost'].includes(l.status)).map(lead => (
                    <div key={lead.id} className="flex items-center justify-between py-2 border-t border-gray-50">
                      <div>
                        <span className="font-medium text-gray-700 text-sm">{lead.name}</span>
                        {lead.company && <span className="text-gray-400 text-xs ml-2">{lead.company}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        {lead.estimated_value && <span className="text-sm font-semibold text-gray-600">{formatCurrency(lead.estimated_value)}</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].color}`}>{STATUS_CONFIG[lead.status].label}</span>
                        <button onClick={() => openEdit(lead)} className="p-1 text-gray-400 hover:text-gray-600"><Edit2 size={13}/></button>
                        <button onClick={() => deleteLead(lead.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {/* ── PIPELINE VIEW (Kanban columns) ── */}
        {viewMode === 'pipeline' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {(['new','contacted','quoted','negotiating','won','lost'] as LeadStatus[]).map(stage => {
              const stageLeads = filtered.filter(l => l.status === stage)
              const stageVal = stageLeads.reduce((s, l) => s + (l.estimated_value || 0), 0)
              const cfg = STATUS_CONFIG[stage]
              return (
                <div key={stage} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className={`px-3 py-2.5 ${cfg.bg} border-b border-gray-100`}>
                    <p className={`text-xs font-bold ${cfg.color} uppercase tracking-wide`}>{cfg.label}</p>
                    <p className="text-xs text-gray-400">{stageLeads.length} · {formatCurrency(stageVal)}</p>
                  </div>
                  <div className="p-2 space-y-2 min-h-20">
                    {stageLeads.map(l => (
                      <div key={l.id} className="p-2.5 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => openEdit(l)}>
                        <p className="text-xs font-semibold text-gray-900 leading-tight">{l.name}</p>
                        {l.company && <p className="text-xs text-gray-400 mt-0.5">{l.company}</p>}
                        <div className="flex items-center justify-between mt-1.5">
                          {l.estimated_value
                            ? <span className="text-xs font-bold text-orange-500">{formatCurrency(l.estimated_value)}</span>
                            : <span/>}
                          <span className={`text-xs font-bold ${GRADE_STYLE[l.intel.grade]} px-1.5 py-0.5 rounded text-white`}>{l.intel.grade}</span>
                        </div>
                        {l.intel.urgency === 'hot' && <div className="mt-1.5 text-xs text-red-500 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block"/>Hot</div>}
                      </div>
                    ))}
                    {stageLeads.length === 0 && <p className="text-xs text-gray-300 text-center py-4">Empty</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {viewMode === 'list' && (
          <div className="space-y-2">
            {filtered.map(lead => {
              const { intel } = lead
              return (
                <div key={lead.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${GRADE_STYLE[intel.grade]}`}>{intel.grade}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{lead.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_CONFIG[lead.status].bg} ${STATUS_CONFIG[lead.status].color}`}>{STATUS_CONFIG[lead.status].label}</span>
                      {intel.urgency === 'hot' && <span className="text-xs text-red-500 font-semibold flex items-center gap-1"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block"/>Hot</span>}
                    </div>
                    <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                      {lead.company && <span>{lead.company}</span>}
                      {lead.service_interest && <span className="text-orange-500">{lead.service_interest}</span>}
                      <span>{intel.daysSinceContact}d ago</span>
                    </div>
                  </div>
                  {lead.estimated_value && <p className="text-sm font-bold text-gray-700 flex-shrink-0">{formatCurrency(lead.estimated_value)}</p>}
                  <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 flex-shrink-0 focus:outline-none bg-white">
                    {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(lead)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded"><Edit2 size={13}/></button>
                    <button onClick={() => deleteLead(lead.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 size={13}/></button>
                  </div>
                </div>
              )
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                <Target size={36} className="mx-auto text-gray-300 mb-3"/>
                <p className="text-gray-400">No leads match your filter.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editing ? 'Edit Lead' : 'New Lead'}</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Full Name *', key: 'name', col: 2 },
                { label: 'Company', key: 'company', col: 1 },
                { label: 'Source', key: 'source', col: 1, placeholder: 'Referral, Instagram, Google...' },
                { label: 'Email', key: 'email', col: 1, type: 'email' },
                { label: 'Phone', key: 'phone', col: 1 },
                { label: 'Service Interest', key: 'service_interest', col: 1, placeholder: 'Full Wrap, Fleet, Mural...' },
                { label: 'Estimated Value ($)', key: 'estimated_value', col: 1, type: 'number' },
              ].map(f => (
                <div key={f.key} className={f.col === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                  <input type={f.type || 'text'} value={(form as any)[f.key]}
                    onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder || ''}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as LeadStatus })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveLead} disabled={saving || !form.name.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors">
                {saving ? 'Saving...' : (editing ? 'Update' : 'Add Lead')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
