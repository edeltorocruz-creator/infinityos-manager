'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import {
  Target, Zap, TrendingUp, Plus, Phone, Mail,
  MapPin, Building2, Star, RefreshCw, ChevronRight,
  Loader, UserPlus, Sparkles, X, CheckCircle, Filter
} from 'lucide-react'

// ── Business types with high wrap potential in NC ──
const PROSPECT_TYPES = [
  { type: 'Food Truck',        icon: '🚚', avgValue: 4500,  tags: ['food truck wrap', 'full wrap'],        reason: 'Food trucks need wraps to stand out — high visibility marketing' },
  { type: 'Plumbing Co.',      icon: '🔧', avgValue: 8500,  tags: ['fleet', 'van wrap', 'truck wrap'],     reason: 'Service fleets = moving billboards. Multiple vehicles.' },
  { type: 'HVAC Company',      icon: '❄️', avgValue: 9200,  tags: ['fleet', 'van wrap'],                   reason: 'HVAC companies run 3-10 vans. Fleet deals = big tickets.' },
  { type: 'Landscaping',       icon: '🌿', avgValue: 6800,  tags: ['truck wrap', 'trailer'],               reason: 'Trucks and trailers always visible in neighborhoods.' },
  { type: 'Real Estate Agent', icon: '🏠', avgValue: 2800,  tags: ['car wrap', 'partial wrap'],            reason: 'Personal branding on cars, high ROI for agents.' },
  { type: 'Pizza / Delivery',  icon: '🍕', avgValue: 3200,  tags: ['car wrap', 'delivery'],                reason: 'Delivery cars need branding. Fast turnaround.' },
  { type: 'Electrician',       icon: '⚡', avgValue: 7200,  tags: ['van wrap', 'truck wrap', 'fleet'],     reason: 'Electricians invest in trucks — wraps = professionalism.' },
  { type: 'Towing Company',    icon: '🏗️', avgValue: 5500,  tags: ['truck wrap', 'tow truck'],             reason: 'Tow trucks on highways 24/7 = maximum exposure.' },
  { type: 'Cleaning Service',  icon: '🧹', avgValue: 4200,  tags: ['van wrap', 'car wrap'],                reason: 'House cleaners in neighborhoods daily — wraps bring leads.' },
  { type: 'Construction',      icon: '🏗️', avgValue: 12000, tags: ['fleet', 'truck', 'trailer', 'mural'], reason: 'Construction sites + fleet vehicles = multiple jobs.' },
  { type: 'Auto Dealer',       icon: '🚗', avgValue: 15000, tags: ['fleet', 'showroom', 'window'],         reason: 'Dealerships need window graphics, banners, lot signage.' },
  { type: 'Gym / Fitness',     icon: '💪', avgValue: 5800,  tags: ['wall mural', 'window', 'van'],         reason: 'Murals for gyms + window graphics = recurring client.' },
  { type: 'Restaurant',        icon: '🍽️', avgValue: 4500,  tags: ['window graphics', 'delivery', 'mural'],reason: 'Window graphics + delivery vehicles + murals.' },
  { type: 'Medical Clinic',    icon: '🏥', avgValue: 6500,  tags: ['van wrap', 'window', 'signage'],       reason: 'Medical transport vans + clinic window graphics.' },
  { type: 'Roofing Company',   icon: '🏠', avgValue: 8800,  tags: ['truck wrap', 'trailer', 'fleet'],      reason: 'Roofers run heavy trucks visible across whole city.' },
]

interface ProspectCard {
  id: string
  business_type: string
  company_name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  location: string | null
  estimated_value: number
  priority: 'high' | 'medium' | 'low'
  reason: string
  tags: string[]
  status: 'new' | 'contacted' | 'converted' | 'dismissed'
  ai_pitch: string | null
  created_at: string
}

interface BusinessInsight {
  topService: string
  avgDealSize: number
  bestMonth: string
  winRate: number
  totalRevenue: number
  topClientType: string
}

const PRIORITY_STYLE = {
  high:   { badge: 'bg-red-100 text-red-700',    dot: 'bg-red-500',    label: 'High' },
  medium: { badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400', label: 'Medium' },
  low:    { badge: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-300',   label: 'Low' },
}

export default function ProspectsPage() {
  const router = useRouter()
  const [prospects, setProspects] = useState<ProspectCard[]>([])
  const [insights, setInsights] = useState<BusinessInsight | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingAI, setGeneratingAI] = useState<string | null>(null)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>('new')
  const [savingForm, setSavingForm] = useState(false)
  const [aiStrategy, setAiStrategy] = useState<string | null>(null)
  const [loadingStrategy, setLoadingStrategy] = useState(false)

  const [form, setForm] = useState({
    business_type: 'Food Truck', company_name: '', contact_name: '',
    phone: '', email: '', location: 'Raleigh, NC',
    estimated_value: '', priority: 'medium' as 'high' | 'medium' | 'low', reason: ''
  })

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    // Load prospects
    const { data: prospectsData } = await supabase
      .from('prospects')
      .select('*')
      .order('created_at', { ascending: false })

    if (prospectsData) setProspects(prospectsData as ProspectCard[])

    // Load business insights from existing data
    const [quotesRes, leadsRes, invoicesRes] = await Promise.all([
      supabase.from('quotes').select('items, total, status, created_at').eq('status', 'approved'),
      supabase.from('leads').select('service_interest, estimated_value, status'),
      supabase.from('invoices').select('total, status').eq('status', 'paid'),
    ])

    // Calculate insights
    if (quotesRes.data && quotesRes.data.length > 0) {
      const allItems = quotesRes.data.flatMap((q: any) => q.items || [])
      const serviceCount: Record<string, number> = {}
      allItems.forEach((item: any) => {
        serviceCount[item.label] = (serviceCount[item.label] || 0) + 1
      })
      const topService = Object.entries(serviceCount).sort(([, a], [, b]) => b - a)[0]?.[0] || 'Full Wrap'
      const avgDeal = quotesRes.data.reduce((s: number, q: any) => s + q.total, 0) / quotesRes.data.length
      const totalRev = invoicesRes.data?.reduce((s: number, i: any) => s + i.total, 0) || 0
      const wonLeads = leadsRes.data?.filter((l: any) => l.status === 'won').length || 0
      const totalLeads = leadsRes.data?.length || 1
      setInsights({
        topService,
        avgDealSize: Math.round(avgDeal),
        bestMonth: new Date().toLocaleString('en-US', { month: 'long' }),
        winRate: Math.round((wonLeads / totalLeads) * 100),
        totalRevenue: totalRev,
        topClientType: 'Food Truck / Fleet',
      })
    }
    setLoading(false)
  }

  // Generate AI pitch for one prospect
  async function generatePitch(prospect: ProspectCard) {
    setGeneratingAI(prospect.id)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are the sales voice for Infinity Wrap Design, a vehicle wrap and graphics company in North Carolina. Write short, confident, direct sales outreach. No fluff. Sound like a real person texting or calling — not a robot. Use the business context provided.`,
          messages: [{
            role: 'user',
            content: `Write a short cold outreach script for this prospect. Include: 1) A 2-sentence text message they can send right now. 2) A 30-second phone script. 3) One specific hook based on their business type.

Prospect: ${prospect.business_type} — "${prospect.company_name || 'the business'}"
Location: ${prospect.location || 'North Carolina'}
Estimated value: $${prospect.estimated_value}
Why they need wraps: ${prospect.reason}
Tags: ${prospect.tags?.join(', ')}

Keep it under 200 words total. Format with clear labels: TEXT: / CALL: / HOOK:`
          }]
        })
      })
      const data = await res.json()
      const pitch = data.content?.find((c: any) => c.type === 'text')?.text || 'Could not generate pitch.'
      await supabase.from('prospects').update({ ai_pitch: pitch }).eq('id', prospect.id)
      setProspects(p => p.map(pr => pr.id === prospect.id ? { ...pr, ai_pitch: pitch } : pr))
    } catch (e) {
      console.error(e)
    }
    setGeneratingAI(null)
  }

  // Generate full outreach strategy
  async function generateStrategy() {
    setLoadingStrategy(true)
    setAiStrategy(null)
    const activeProspects = prospects.filter(p => p.status === 'new').slice(0, 6)
    const summary = activeProspects.map(p =>
      `${p.business_type} (${p.company_name || 'unnamed'}) — $${p.estimated_value} potential`
    ).join('\n')

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a sales coach for Infinity Wrap Design, a vehicle wrap company in North Carolina. Give sharp, actionable weekly outreach strategy. Be specific about timing, messaging, and prioritization. Max 300 words.`,
          messages: [{
            role: 'user',
            content: `Here are my top prospects this week:\n\n${summary || 'No prospects yet — suggest where to start'}\n\n${insights ? `Business context: avg deal $${insights.avgDealSize}, top service: ${insights.topService}, win rate: ${insights.winRate}%` : ''}\n\nGive me a week-by-week outreach plan. Be specific — who to call first, what to say, when to follow up.`
          }]
        })
      })
      const data = await res.json()
      setAiStrategy(data.content?.find((c: any) => c.type === 'text')?.text || '')
    } catch (e) {
      setAiStrategy('Could not generate strategy. Check connection.')
    }
    setLoadingStrategy(false)
  }

  // Generate suggested prospects from business type list
  async function autoGenerateProspects() {
    setGeneratingAll(true)
    const topTypes = PROSPECT_TYPES.sort((a, b) => b.avgValue - a.avgValue).slice(0, 8)
    const toInsert = topTypes.map(t => ({
      business_type: t.type,
      company_name: '',
      contact_name: null,
      phone: null,
      email: null,
      location: 'Raleigh / Wake County, NC',
      estimated_value: t.avgValue,
      priority: t.avgValue >= 8000 ? 'high' : t.avgValue >= 5000 ? 'medium' : 'low' as any,
      reason: t.reason,
      tags: t.tags,
      status: 'new',
      ai_pitch: null,
    }))
    await supabase.from('prospects').insert(toInsert)
    await loadData()
    setGeneratingAll(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('prospects').update({ status }).eq('id', id)
    setProspects(p => p.map(pr => pr.id === id ? { ...pr, status: status as any } : pr))
  }

  async function convertToLead(prospect: ProspectCard) {
    const typeInfo = PROSPECT_TYPES.find(t => t.type === prospect.business_type)
    const { data: lead } = await supabase.from('leads').insert({
      name: prospect.contact_name || prospect.company_name || prospect.business_type,
      company: prospect.company_name || null,
      phone: prospect.phone || null,
      email: prospect.email || null,
      service_interest: prospect.tags?.[0] || prospect.business_type,
      estimated_value: prospect.estimated_value,
      status: 'new',
      source: 'Prospect Intelligence',
      notes: prospect.reason,
    }).select().single()

    await supabase.from('prospects').update({ status: 'converted' }).eq('id', prospect.id)
    setProspects(p => p.map(pr => pr.id === prospect.id ? { ...pr, status: 'converted' } : pr))
    if (lead) router.push('/leads')
  }

  async function saveProspect() {
    if (!form.company_name.trim() && !form.contact_name.trim()) return
    setSavingForm(true)
    const typeInfo = PROSPECT_TYPES.find(t => t.type === form.business_type)
    await supabase.from('prospects').insert({
      business_type: form.business_type,
      company_name: form.company_name || null,
      contact_name: form.contact_name || null,
      phone: form.phone || null,
      email: form.email || null,
      location: form.location || 'North Carolina',
      estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : (typeInfo?.avgValue || 3000),
      priority: form.priority,
      reason: form.reason || typeInfo?.reason || '',
      tags: typeInfo?.tags || [],
      status: 'new',
      ai_pitch: null,
    })
    setSavingForm(false)
    setShowAddForm(false)
    await loadData()
  }

  const filtered = useMemo(() =>
    prospects.filter(p => filterStatus === 'all' || p.status === filterStatus)
  , [prospects, filterStatus])

  const stats = useMemo(() => ({
    new: prospects.filter(p => p.status === 'new').length,
    contacted: prospects.filter(p => p.status === 'contacted').length,
    converted: prospects.filter(p => p.status === 'converted').length,
    totalPipeline: prospects.filter(p => p.status === 'new').reduce((s, p) => s + p.estimated_value, 0),
  }), [prospects])

  const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
  const lb = "text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block"

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading prospect intelligence...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Target size={26} className="text-orange-500"/> Prospect Intelligence
            </h1>
            <p className="text-gray-500 mt-1">Businesses that need wraps — go get them</p>
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button onClick={generateStrategy} disabled={loadingStrategy}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {loadingStrategy ? <Loader size={14} className="animate-spin"/> : <Sparkles size={14} className="text-orange-400"/>}
              Weekly Strategy
            </button>
            {prospects.length === 0 && (
              <button onClick={autoGenerateProspects} disabled={generatingAll}
                className="flex items-center gap-2 bg-orange-100 hover:bg-orange-200 text-orange-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {generatingAll ? <Loader size={14} className="animate-spin"/> : <Zap size={14}/>}
                Auto-Generate
              </button>
            )}
            <button onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              <Plus size={16}/>Add Prospect
            </button>
          </div>
        </div>

        {/* Business Insights */}
        {insights && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-6 text-white">
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wide mb-3 flex items-center gap-2">
              <TrendingUp size={12}/>Your Business Intelligence
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Top Service',  value: insights.topService,               sub: 'most quoted' },
                { label: 'Avg Deal',     value: formatCurrency(insights.avgDealSize), sub: 'per project' },
                { label: 'Win Rate',     value: `${insights.winRate}%`,            sub: 'leads to close' },
                { label: 'Revenue',      value: formatCurrency(insights.totalRevenue), sub: 'collected' },
                { label: 'Best Targets', value: insights.topClientType,            sub: 'by revenue' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-gray-400 text-xs">{s.label}</p>
                  <p className="text-white font-bold text-sm mt-0.5">{s.value}</p>
                  <p className="text-gray-500 text-xs">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Weekly Strategy */}
        {aiStrategy && (
          <div className="bg-white border border-orange-200 rounded-2xl p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="font-bold text-gray-900 flex items-center gap-2">
                <Sparkles size={16} className="text-orange-500"/>Weekly Outreach Strategy
              </p>
              <button onClick={() => setAiStrategy(null)} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{aiStrategy}</div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'New',           value: stats.new,                            color: 'text-blue-600' },
            { label: 'Contacted',     value: stats.contacted,                      color: 'text-yellow-600' },
            { label: 'Converted',     value: stats.converted,                      color: 'text-green-600' },
            { label: 'Potential $',   value: formatCurrency(stats.totalPipeline),  color: 'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5">
          {[['all','All'],['new','New'],['contacted','Contacted'],['converted','Converted'],['dismissed','Dismissed']].map(([v, l]) => (
            <button key={v} onClick={() => setFilterStatus(v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${filterStatus === v ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Prospect cards */}
        {filtered.length === 0 && prospects.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Target size={48} className="mx-auto text-gray-200 mb-4"/>
            <p className="text-gray-600 font-semibold text-lg mb-1">No prospects yet</p>
            <p className="text-gray-400 text-sm mb-6">Let the system suggest businesses that need wraps in your area</p>
            <button onClick={autoGenerateProspects} disabled={generatingAll}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-semibold transition-colors">
              {generatingAll ? <Loader size={16} className="animate-spin"/> : <Zap size={16}/>}
              Auto-generate from local business types
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <p className="text-gray-400">No prospects in this filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(prospect => {
              const priorityStyle = PRIORITY_STYLE[prospect.priority as keyof typeof PRIORITY_STYLE] || PRIORITY_STYLE.medium
              const typeInfo = PROSPECT_TYPES.find(t => t.type === prospect.business_type)
              const isGenerating = generatingAI === prospect.id

              return (
                <div key={prospect.id} className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-5 ${prospect.status === 'converted' ? 'opacity-60' : ''}`}>
                  {/* Card header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{typeInfo?.icon || '🏢'}</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">
                            {prospect.company_name || prospect.business_type}
                          </p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${priorityStyle.badge}`}>
                            {priorityStyle.label}
                          </span>
                          {prospect.status === 'converted' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Converted ✓</span>
                          )}
                        </div>
                        <p className="text-gray-500 text-sm">{prospect.business_type}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-black text-gray-900">{formatCurrency(prospect.estimated_value)}</p>
                      <p className="text-xs text-gray-400">est. value</p>
                    </div>
                  </div>

                  {/* Contact info */}
                  <div className="flex flex-wrap gap-3 mb-3 text-xs text-gray-400">
                    {prospect.location && <span className="flex items-center gap-1"><MapPin size={11}/>{prospect.location}</span>}
                    {prospect.contact_name && <span className="flex items-center gap-1"><Building2 size={11}/>{prospect.contact_name}</span>}
                    {prospect.phone && <span className="flex items-center gap-1"><Phone size={11}/>{prospect.phone}</span>}
                    {prospect.email && <span className="flex items-center gap-1"><Mail size={11}/>{prospect.email}</span>}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {prospect.tags?.map((tag: string) => (
                      <span key={tag} className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full font-medium">{tag}</span>
                    ))}
                  </div>

                  {/* Why reason */}
                  <p className="text-xs text-gray-500 italic mb-3 leading-relaxed">{prospect.reason}</p>

                  {/* AI Pitch */}
                  {prospect.ai_pitch && (
                    <div className="bg-gray-50 rounded-xl p-3 mb-3">
                      <p className="text-xs font-bold text-purple-600 flex items-center gap-1 mb-2"><Sparkles size={11}/>AI Outreach Script</p>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{prospect.ai_pitch}</p>
                    </div>
                  )}

                  {/* Actions */}
                  {prospect.status !== 'converted' && prospect.status !== 'dismissed' && (
                    <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => convertToLead(prospect)}
                        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                        <UserPlus size={12}/>Move to Leads
                      </button>
                      <button onClick={() => generatePitch(prospect)} disabled={isGenerating}
                        className="flex items-center gap-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                        {isGenerating ? <Loader size={11} className="animate-spin"/> : <Sparkles size={11}/>}
                        {prospect.ai_pitch ? 'Regenerate' : 'Get Script'}
                      </button>
                      <select value={prospect.status}
                        onChange={e => updateStatus(prospect.id, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none">
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="dismissed">Dismiss</option>
                      </select>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Business Type Suggestions (bottom) */}
        {prospects.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="font-bold text-gray-900 mb-1">More Business Types to Target</p>
            <p className="text-gray-400 text-sm mb-4">Click to add as prospect</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {PROSPECT_TYPES.map(t => (
                <button key={t.type}
                  onClick={async () => {
                    await supabase.from('prospects').insert({
                      business_type: t.type, company_name: '', contact_name: null,
                      phone: null, email: null, location: 'Raleigh / Wake County, NC',
                      estimated_value: t.avgValue,
                      priority: t.avgValue >= 8000 ? 'high' : t.avgValue >= 5000 ? 'medium' : 'low',
                      reason: t.reason, tags: t.tags, status: 'new', ai_pitch: null,
                    })
                    await loadData()
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-orange-50 border border-gray-200 hover:border-orange-300 rounded-xl text-sm transition-colors text-left">
                  <span>{t.icon}</span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-700 text-xs truncate">{t.type}</p>
                    <p className="text-orange-500 text-xs font-bold">{formatCurrency(t.avgValue)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADD FORM MODAL */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-900">Add Prospect</h2>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className={lb}>Business Type</label>
                <select value={form.business_type} onChange={e => setForm({ ...form, business_type: e.target.value })} className={ic}>
                  {PROSPECT_TYPES.map(t => <option key={t.type} value={t.type}>{t.icon} {t.type}</option>)}
                </select>
              </div>
              <div>
                <label className={lb}>Company Name</label>
                <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
                  placeholder="Business name" className={ic}/>
              </div>
              <div>
                <label className={lb}>Contact Name</label>
                <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Owner / manager" className={ic}/>
              </div>
              <div>
                <label className={lb}>Phone</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="(919) 000-0000" className={ic}/>
              </div>
              <div>
                <label className={lb}>Email</label>
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  placeholder="email@business.com" className={ic}/>
              </div>
              <div>
                <label className={lb}>Location</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  placeholder="Raleigh, NC" className={ic}/>
              </div>
              <div>
                <label className={lb}>Estimated Value ($)</label>
                <input type="number" value={form.estimated_value} onChange={e => setForm({ ...form, estimated_value: e.target.value })}
                  placeholder={String(PROSPECT_TYPES.find(t => t.type === form.business_type)?.avgValue || 4000)} className={ic}/>
              </div>
              <div>
                <label className={lb}>Priority</label>
                <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })} className={ic}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={lb}>Why they need wraps</label>
                <textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} rows={2}
                  placeholder={PROSPECT_TYPES.find(t => t.type === form.business_type)?.reason || 'Why this prospect?'}
                  className={ic} style={{ resize: 'none' }}/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowAddForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={saveProspect} disabled={savingForm || (!form.company_name.trim() && !form.contact_name.trim())}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold">
                {savingForm ? 'Saving...' : 'Add Prospect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
