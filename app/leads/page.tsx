'use client'

export const dynamic = 'force-dynamic'


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Phone, Mail, Target, Edit2, Trash2, ChevronDown } from 'lucide-react'

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'negotiating' | 'won' | 'lost'

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new:         { label: 'New',         color: 'text-blue-700',  bg: 'bg-blue-100' },
  contacted:   { label: 'Contacted',   color: 'text-purple-700',bg: 'bg-purple-100' },
  quoted:      { label: 'Quoted',      color: 'text-orange-700',bg: 'bg-orange-100' },
  negotiating: { label: 'Negotiating', color: 'text-yellow-700',bg: 'bg-yellow-100' },
  won:         { label: 'Won',         color: 'text-green-700', bg: 'bg-green-100' },
  lost:        { label: 'Lost',        color: 'text-red-700',   bg: 'bg-red-100' },
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
}

const EMPTY_FORM = { name: '', company: '', email: '', phone: '', service_interest: '', status: 'new' as LeadStatus, estimated_value: '', notes: '', source: '' }

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadLeads() }, [])

  async function loadLeads() {
    setLoading(true)
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    if (data) setLeads(data as Lead[])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

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
      status: form.status, estimated_value: form.estimated_value ? parseFloat(form.estimated_value) : null,
      notes: form.notes || null, source: form.source || null
    }
    if (editing) {
      await supabase.from('leads').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('leads').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadLeads()
  }

  async function updateStatus(id: string, status: LeadStatus) {
    await supabase.from('leads').update({ status }).eq('id', id)
    setLeads(leads.map(l => l.id === id ? { ...l, status } : l))
  }

  async function deleteLead(id: string) {
    if (!confirm('Delete this lead?')) return
    await supabase.from('leads').delete().eq('id', id)
    loadLeads()
  }

  const filtered = leads.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) ||
      (l.company || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: leads.length,
    active: leads.filter(l => !['won','lost'].includes(l.status)).length,
    won: leads.filter(l => l.status === 'won').length,
    pipeline: leads.filter(l => !['won','lost'].includes(l.status)).reduce((s, l) => s + (l.estimated_value || 0), 0),
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Leads</h1>
            <p className="text-gray-500 mt-1">Sales Pipeline — Infinity Wrap Design</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors">
            <Plus size={20} /> New Lead
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Leads', value: stats.total, color: 'text-gray-900' },
            { label: 'Active', value: stats.active, color: 'text-blue-600' },
            { label: 'Won', value: stats.won, color: 'text-green-600' },
            { label: 'Pipeline Value', value: `$${stats.pipeline.toLocaleString()}`, color: 'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-sm mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-60">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
          </div>
          <div className="flex gap-2">
            {['all', ...STAGES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                {s === 'all' ? 'All' : STATUS_CONFIG[s as LeadStatus]?.label || s}
              </button>
            ))}
          </div>
        </div>

        {/* Leads List */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading leads...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Target size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No leads yet</p>
            <button onClick={openNew} className="text-orange-500 hover:underline mt-2 inline-block">Add your first lead →</button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(lead => {
              const status = STATUS_CONFIG[lead.status]
              return (
                <div key={lead.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{lead.name}</h3>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                        {lead.source && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{lead.source}</span>}
                      </div>
                      {lead.company && <p className="text-gray-500 text-sm mb-2">{lead.company}</p>}
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        {lead.service_interest && <span className="text-orange-600 font-medium">{lead.service_interest}</span>}
                        {lead.phone && <span className="flex items-center gap-1"><Phone size={13} />{lead.phone}</span>}
                        {lead.email && <span className="flex items-center gap-1"><Mail size={13} />{lead.email}</span>}
                      </div>
                      {lead.notes && <p className="text-gray-400 text-xs mt-2 italic">{lead.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      {lead.estimated_value && (
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">${lead.estimated_value.toLocaleString()}</p>
                          <p className="text-gray-400 text-xs">est. value</p>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <select value={lead.status} onChange={e => updateStatus(lead.id, e.target.value as LeadStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white cursor-pointer">
                          {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                        </select>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(lead)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => deleteLead(lead.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editing ? 'Edit Lead' : 'New Lead'}</h2>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Full Name *', key: 'name', col: 2 },
                { label: 'Company', key: 'company', col: 1 },
                { label: 'Source', key: 'source', col: 1, placeholder: 'Referral, Instagram...' },
                { label: 'Email', key: 'email', col: 1 },
                { label: 'Phone', key: 'phone', col: 1 },
                { label: 'Service Interest', key: 'service_interest', col: 1, placeholder: 'Full Wrap, Fleet...' },
                { label: 'Estimated Value ($)', key: 'estimated_value', col: 1, type: 'number' },
              ].map(f => (
                <div key={f.key} className={f.col === 2 ? 'col-span-2' : ''}>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                  <input type={f.type || 'text'} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    placeholder={f.placeholder || ''}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as LeadStatus })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={saveLead} disabled={saving || !form.name.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold">
                {saving ? 'Saving...' : (editing ? 'Update' : 'Add Lead')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
