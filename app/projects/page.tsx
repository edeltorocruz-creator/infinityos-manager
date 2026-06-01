'use client'

export const dynamic = 'force-dynamic'


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { Plus, Search, Folder, Calendar, DollarSign, Edit2, Trash2, CheckCircle } from 'lucide-react'

type ProjectStatus = 'quoted' | 'deposit_paid' | 'in_production' | 'installation' | 'completed' | 'invoiced'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; step: number }> = {
  quoted:       { label: 'Quoted',       color: 'text-blue-700',   bg: 'bg-blue-100',   step: 1 },
  deposit_paid: { label: 'Deposit Paid', color: 'text-purple-700', bg: 'bg-purple-100', step: 2 },
  in_production:{ label: 'In Production',color: 'text-yellow-700', bg: 'bg-yellow-100', step: 3 },
  installation: { label: 'Installation', color: 'text-orange-700', bg: 'bg-orange-100', step: 4 },
  completed:    { label: 'Completed',    color: 'text-green-700',  bg: 'bg-green-100',  step: 5 },
  invoiced:     { label: 'Invoiced',     color: 'text-gray-700',   bg: 'bg-gray-100',   step: 6 },
}

const STAGES: ProjectStatus[] = ['quoted','deposit_paid','in_production','installation','completed','invoiced']

interface Project {
  id: string
  name: string
  client_id: string | null
  status: ProjectStatus
  total_amount: number | null
  notes: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
  client?: { name: string }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({ name: '', client_id: '', status: 'quoted' as ProjectStatus, total_amount: '', notes: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [projRes, clientRes] = await Promise.all([
      supabase.from('projects').select('*, client:clients(name)').order('created_at', { ascending: false }),
      supabase.from('clients').select('id, name').order('name'),
    ])
    if (projRes.data) setProjects(projRes.data as Project[])
    if (clientRes.data) setClients(clientRes.data)
    setLoading(false)
  }

  async function saveProject() {
    if (!form.name.trim()) return
    setSaving(true)
    const payload: any = {
      name: form.name,
      client_id: form.client_id || null,
      status: form.status,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      notes: form.notes || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    if (editing) {
      await supabase.from('projects').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('projects').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadAll()
  }

  async function updateStatus(id: string, status: ProjectStatus) {
    await supabase.from('projects').update({ status }).eq('id', id)
    setProjects(projects.map(p => p.id === id ? { ...p, status } : p))
  }

  async function deleteProject(id: string) {
    if (!confirm('Delete this project?')) return
    await supabase.from('projects').delete().eq('id', id)
    loadAll()
  }

  const filtered = projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.client?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  })

  const stats = {
    total: projects.length,
    active: projects.filter(p => !['completed','invoiced'].includes(p.status)).length,
    completed: projects.filter(p => p.status === 'completed' || p.status === 'invoiced').length,
    value: projects.filter(p => !['invoiced'].includes(p.status)).reduce((s, p) => s + (p.total_amount || 0), 0),
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-500 mt-1">Active & completed jobs</p>
          </div>
          <button onClick={() => { setEditing(null); setForm({ name: '', client_id: '', status: 'quoted', total_amount: '', notes: '', start_date: '', end_date: '' }); setShowForm(true) }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors">
            <Plus size={20} /> New Project
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Active', value: stats.active, color: 'text-orange-500' },
            { label: 'Completed', value: stats.completed, color: 'text-green-600' },
            { label: 'Open Value', value: formatCurrency(stats.value), color: 'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <p className="text-gray-500 text-sm mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-60">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
          </div>
          <div className="flex flex-wrap gap-2">
            {['all', ...STAGES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filterStatus === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                {s === 'all' ? 'All' : STATUS_CONFIG[s as ProjectStatus]?.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading projects...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Folder size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No projects yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(project => {
              const status = STATUS_CONFIG[project.status]
              const progress = Math.round((status.step / 6) * 100)
              return (
                <div key={project.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold text-gray-900">{project.name}</h3>
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                      </div>
                      {project.client?.name && <p className="text-gray-500 text-sm mb-2">{project.client.name}</p>}
                      <div className="flex gap-4 text-xs text-gray-400">
                        {project.start_date && <span className="flex items-center gap-1"><Calendar size={11} />{new Date(project.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                        {project.end_date && <span>→ {new Date(project.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-6">
                      {project.total_amount && (
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(project.total_amount)}</p>
                        </div>
                      )}
                      <div className="flex flex-col gap-1">
                        <select value={project.status} onChange={e => updateStatus(project.id, e.target.value as ProjectStatus)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white cursor-pointer">
                          {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                        </select>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setEditing(project); setForm({ name: project.name, client_id: project.client_id || '', status: project.status, total_amount: project.total_amount?.toString() || '', notes: project.notes || '', start_date: project.start_date || '', end_date: project.end_date || '' }); setShowForm(true) }}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => deleteProject(project.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${project.status === 'completed' || project.status === 'invoiced' ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editing ? 'Edit Project' : 'New Project'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Project Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Fleet Wrap — Acme Corp"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Client</label>
                <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">No client assigned</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {STAGES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Total Amount ($)</label>
                  <input type="number" value={form.total_amount} onChange={e => setForm({ ...form, total_amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Start Date</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">End Date</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={saveProject} disabled={saving || !form.name.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold">
                {saving ? 'Saving...' : (editing ? 'Update' : 'Create Project')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
