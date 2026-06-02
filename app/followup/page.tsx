'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import {
  Phone, Mail, MessageSquare, Clock, CheckCircle,
  AlertTriangle, TrendingUp, Users, DollarSign,
  ChevronDown, ChevronUp, Plus, X, Flame
} from 'lucide-react'

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost'
type ContactMethod = 'call' | 'text' | 'email' | 'visit' | 'whatsapp' | 'other'

interface Lead {
  id: string
  name: string
  company: string | null
  phone: string | null
  email: string | null
  service_interest: string | null
  status: LeadStatus
  estimated_value: number | null
  notes: string | null
  source: string | null
  last_contacted_at: string | null
  next_followup_at: string | null
  contact_count: number
  created_at: string
  updated_at: string
}

interface LeadContact {
  id: string
  lead_id: string
  method: ContactMethod
  notes: string | null
  contacted_at: string
}

const METHOD_CONFIG: Record<ContactMethod, { label: string; icon: any; color: string }> = {
  call:      { label: 'Call',      icon: Phone,          color: 'text-blue-600 bg-blue-50' },
  text:      { label: 'Text',      icon: MessageSquare,  color: 'text-green-600 bg-green-50' },
  email:     { label: 'Email',     icon: Mail,           color: 'text-purple-600 bg-purple-50' },
  visit:     { label: 'Visit',     icon: Users,          color: 'text-orange-600 bg-orange-50' },
  whatsapp:  { label: 'WhatsApp',  icon: MessageSquare,  color: 'text-green-700 bg-green-50' },
  other:     { label: 'Other',     icon: Clock,          color: 'text-gray-600 bg-gray-50' },
}

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
}

function getUrgency(lead: Lead): { level: 'hot' | 'warm' | 'cold' | 'stale'; days: number; label: string; next: string } {
  const days = daysSince(lead.last_contacted_at || lead.created_at)
  if (days <= 2)  return { level: 'hot',   days, label: 'Hot',   next: 'Tomorrow' }
  if (days <= 7)  return { level: 'warm',  days, label: 'Warm',  next: 'Within 2 days' }
  if (days <= 14) return { level: 'cold',  days, label: 'Cold',  next: 'Today' }
  return              { level: 'stale', days, label: 'Stale', next: 'URGENT — today' }
}

const URGENCY_STYLE = {
  hot:   { card: 'border-orange-200 bg-orange-50/30', dot: 'bg-red-500 animate-pulse', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400' },
  warm:  { card: 'border-yellow-200 bg-yellow-50/20', dot: 'bg-yellow-400',            badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
  cold:  { card: 'border-blue-200 bg-blue-50/10',    dot: 'bg-blue-400',              badge: 'bg-blue-100 text-blue-700',    bar: 'bg-blue-400' },
  stale: { card: 'border-red-300 bg-red-50/20',      dot: 'bg-red-600',               badge: 'bg-red-100 text-red-700',     bar: 'bg-red-500' },
}

const BUCKET_CONFIG = [
  { key: '0-3',  label: 'Contactar Hoy',   days: 3,  color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
  { key: '3-7',  label: '3–7 días',        days: 7,  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  { key: '7-14', label: '7–14 días',       days: 14, color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
  { key: '14+',  label: 'Más de 14 días',  days: 999,color: 'text-gray-500',   bg: 'bg-gray-50 border-gray-200' },
]

export default function FollowUpPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [contacts, setContacts] = useState<Record<string, LeadContact[]>>({})
  const [loading, setLoading] = useState(true)
  const [expandedLead, setExpandedLead] = useState<string | null>(null)
  const [logModal, setLogModal] = useState<Lead | null>(null)
  const [logMethod, setLogMethod] = useState<ContactMethod>('call')
  const [logNotes, setLogNotes] = useState('')
  const [logNextDate, setLogNextDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterBucket, setFilterBucket] = useState<string>('all')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: leadsData } = await supabase
      .from('leads')
      .select('*')
      .not('status', 'in', '("won","lost")')
      .order('next_followup_at', { ascending: true, nullsFirst: true })

    if (leadsData) {
      setLeads(leadsData as Lead[])
      // Load contact history for all leads
      const ids = leadsData.map((l: any) => l.id)
      if (ids.length > 0) {
        const { data: contactData } = await supabase
          .from('lead_contacts')
          .select('*')
          .in('lead_id', ids)
          .order('contacted_at', { ascending: false })
        if (contactData) {
          const grouped: Record<string, LeadContact[]> = {}
          contactData.forEach((c: LeadContact) => {
            if (!grouped[c.lead_id]) grouped[c.lead_id] = []
            grouped[c.lead_id].push(c)
          })
          setContacts(grouped)
        }
      }
    }
    setLoading(false)
  }

  // Sorted by urgency: stale first, then cold, warm, hot
  const urgencyOrder = { stale: 0, cold: 1, warm: 2, hot: 3 }
  const sortedLeads = useMemo(() =>
    [...leads].sort((a, b) => {
      const ua = getUrgency(a), ub = getUrgency(b)
      if (urgencyOrder[ua.level] !== urgencyOrder[ub.level])
        return urgencyOrder[ua.level] - urgencyOrder[ub.level]
      return ub.days - ua.days
    })
  , [leads])

  const filteredLeads = useMemo(() => {
    if (filterBucket === 'all') return sortedLeads
    const bucket = BUCKET_CONFIG.find(b => b.key === filterBucket)
    if (!bucket) return sortedLeads
    const prevDays = filterBucket === '0-3' ? 0 : filterBucket === '3-7' ? 3 : filterBucket === '7-14' ? 7 : 14
    return sortedLeads.filter(l => {
      const d = daysSince(l.last_contacted_at || l.created_at)
      if (filterBucket === '14+') return d > 14
      return d > prevDays && d <= bucket.days
    })
  }, [sortedLeads, filterBucket])

  const stats = useMemo(() => {
    const active = leads
    const todayCount = active.filter(l => daysSince(l.last_contacted_at || l.created_at) >= 3).length
    const totalValue = active.reduce((s, l) => s + (l.estimated_value || 0), 0)
    const totalWon = 0 // won leads excluded from active
    const convRate = 0
    const staleCount = active.filter(l => daysSince(l.last_contacted_at || l.created_at) > 14).length
    return { total: active.length, todayCount, totalValue, staleCount, convRate }
  }, [leads])

  async function logContact() {
    if (!logModal) return
    setSaving(true)
    const now = new Date().toISOString()

    // Insert contact record
    const { error: ce } = await supabase.from('lead_contacts').insert({
      lead_id: logModal.id,
      method: logMethod,
      notes: logNotes || null,
      contacted_at: now,
    })

    if (ce) { setSaving(false); alert('Error: ' + ce.message); return }

    // Calculate next followup
    let nextFollowup: string | null = null
    if (logNextDate) {
      nextFollowup = new Date(logNextDate).toISOString()
    } else {
      // Auto-suggest: +3 days for active, +7 for cold
      const d = new Date()
      d.setDate(d.getDate() + (logModal.status === 'negotiating' ? 1 : logModal.status === 'quoted' ? 3 : 5))
      nextFollowup = d.toISOString()
    }

    // Update lead
    const { error: le } = await supabase.from('leads').update({
      last_contacted_at: now,
      next_followup_at: nextFollowup,
      contact_count: (logModal.contact_count || 0) + 1,
      status: logModal.status === 'new' ? 'contacted' : logModal.status,
      updated_at: now,
    }).eq('id', logModal.id)

    if (le) { setSaving(false); alert('Error: ' + le.message); return }

    setSaving(false)
    setLogModal(null)
    setLogNotes('')
    setLogNextDate('')
    setLogMethod('call')
    await loadData()
  }

  async function snooze(lead: Lead, days: number) {
    const next = new Date()
    next.setDate(next.getDate() + days)
    await supabase.from('leads').update({
      next_followup_at: next.toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', lead.id)
    await loadData()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen text-gray-400">
      Loading Follow-up Center...
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Flame size={26} className="text-orange-500"/> Follow-up Reminders
          </h1>
          <p className="text-gray-500 mt-1">Contactar hoy — convierte leads fríos en dinero</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Pendientes hoy',    value: stats.todayCount,                icon: AlertTriangle, color: 'text-red-500',    bg: 'bg-red-50' },
            { label: 'Total activos',     value: stats.total,                     icon: Users,         color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'Ignorados +14d',    value: stats.staleCount,                icon: Clock,         color: 'text-gray-500',   bg: 'bg-gray-50' },
            { label: 'Valor en pipeline', value: formatCurrency(stats.totalValue),icon: DollarSign,    color: 'text-orange-500', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className={`inline-flex p-2 rounded-lg ${s.bg} mb-2`}>
                <s.icon size={16} className={s.color}/>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Bucket filter tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          <button onClick={() => setFilterBucket('all')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${filterBucket === 'all' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
            Todos ({leads.length})
          </button>
          {BUCKET_CONFIG.map(b => {
            const count = sortedLeads.filter(l => {
              const d = daysSince(l.last_contacted_at || l.created_at)
              const prev = b.key === '0-3' ? 0 : b.key === '3-7' ? 3 : b.key === '7-14' ? 7 : 14
              if (b.key === '14+') return d > 14
              return d > prev && d <= b.days
            }).length
            return (
              <button key={b.key} onClick={() => setFilterBucket(b.key)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${filterBucket === b.key ? 'bg-gray-900 text-white border-gray-900' : `bg-white border-gray-200 hover:border-gray-400 ${b.color}`}`}>
                {b.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Lead cards */}
        {filteredLeads.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <CheckCircle size={44} className="mx-auto text-green-400 mb-3"/>
            <p className="text-gray-700 font-semibold text-lg">¡Todo al día!</p>
            <p className="text-gray-400 text-sm mt-1">No hay leads pendientes en este rango.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLeads.map(lead => {
              const urgency = getUrgency(lead)
              const style = URGENCY_STYLE[urgency.level]
              const history = contacts[lead.id] || []
              const isExpanded = expandedLead === lead.id
              const nextDate = lead.next_followup_at
                ? new Date(lead.next_followup_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : urgency.next

              return (
                <div key={lead.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${style.card}`}>
                  {/* Main row */}
                  <div className="p-5">
                    <div className="flex items-start gap-4">
                      {/* Urgency indicator */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-1 pt-1">
                        <span className={`w-3 h-3 rounded-full ${style.dot}`}/>
                        <span className="text-xs font-bold text-gray-400">{urgency.days}d</span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-gray-900">{lead.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{urgency.label}</span>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{lead.status}</span>
                          {lead.contact_count > 0 && (
                            <span className="text-xs text-gray-400">{lead.contact_count} contacto{lead.contact_count !== 1 ? 's' : ''}</span>
                          )}
                        </div>
                        {lead.company && <p className="text-sm text-gray-500">{lead.company}</p>}
                        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                          {lead.service_interest && <span className="text-orange-500 font-medium">{lead.service_interest}</span>}
                          {lead.phone && <span className="flex items-center gap-1"><Phone size={11}/>{lead.phone}</span>}
                          {lead.email && <span className="flex items-center gap-1"><Mail size={11}/>{lead.email}</span>}
                        </div>
                        {/* Next followup */}
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock size={12} className="text-orange-400"/>
                          <span className="text-xs text-orange-600 font-medium">
                            Próximo seguimiento: {nextDate}
                          </span>
                        </div>
                        {lead.last_contacted_at && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            Último contacto: {new Date(lead.last_contacted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        )}
                      </div>

                      {/* Right: value + actions */}
                      <div className="flex-shrink-0 flex flex-col items-end gap-2">
                        {lead.estimated_value && (
                          <div className="text-right">
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(lead.estimated_value)}</p>
                            <p className="text-xs text-gray-400">est. valor</p>
                          </div>
                        )}
                        <button onClick={() => setLogModal(lead)}
                          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                          <CheckCircle size={14}/>Contactado
                        </button>
                        <div className="flex gap-1">
                          <button onClick={() => snooze(lead, 1)}
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors">+1d</button>
                          <button onClick={() => snooze(lead, 3)}
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors">+3d</button>
                          <button onClick={() => snooze(lead, 7)}
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 hover:bg-gray-100 rounded transition-colors">+7d</button>
                        </div>
                      </div>
                    </div>

                    {/* Expand history */}
                    {history.length > 0 && (
                      <button
                        onClick={() => setExpandedLead(isExpanded ? null : lead.id)}
                        className="mt-3 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                        {isExpanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
                        {isExpanded ? 'Ocultar historial' : `Ver historial (${history.length})`}
                      </button>
                    )}
                  </div>

                  {/* History panel */}
                  {isExpanded && history.length > 0 && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 rounded-b-2xl">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Historial de contactos</p>
                      <div className="space-y-2">
                        {history.map(c => {
                          const mc = METHOD_CONFIG[c.method as ContactMethod] || METHOD_CONFIG.other
                          return (
                            <div key={c.id} className="flex items-start gap-3">
                              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg flex-shrink-0 ${mc.color}`}>
                                <mc.icon size={11}/>{mc.label}
                              </span>
                              <div className="flex-1 min-w-0">
                                {c.notes && <p className="text-xs text-gray-700">{c.notes}</p>}
                                <p className="text-xs text-gray-400 mt-0.5">
                                  {new Date(c.contacted_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* LOG CONTACT MODAL */}
      {logModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Registrar Contacto</h2>
                <p className="text-gray-500 text-sm">{logModal.name}{logModal.company ? ` · ${logModal.company}` : ''}</p>
              </div>
              <button onClick={() => { setLogModal(null); setLogNotes(''); setLogNextDate('') }}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4">
              {/* Method */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 block">Método de contacto</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.entries(METHOD_CONFIG) as [ContactMethod, any][]).map(([key, cfg]) => (
                    <button key={key} onClick={() => setLogMethod(key)}
                      className={`flex items-center gap-1.5 py-2.5 px-3 rounded-xl text-sm font-semibold border transition-colors ${logMethod === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
                      <cfg.icon size={13}/>{cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notas del contacto</label>
                <textarea value={logNotes} onChange={e => setLogNotes(e.target.value)} rows={3}
                  placeholder="Qué se habló, interés del cliente, objeciones..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
              </div>

              {/* Next followup */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">
                  Próximo seguimiento <span className="font-normal text-gray-400">(opcional — se calcula auto)</span>
                </label>
                <input type="date" value={logNextDate} onChange={e => setLogNextDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setLogModal(null); setLogNotes(''); setLogNextDate('') }}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={logContact} disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition-colors">
                {saving ? 'Guardando...' : '✓ Confirmar contacto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
