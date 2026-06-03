'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { FolderOpen, Plus, Search, FileText, Receipt, ChevronRight, Zap } from 'lucide-react'

type ProjectStatus = 'quoted' | 'deposit_paid' | 'in_production' | 'installation' | 'completed' | 'invoiced'

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; bg: string; step: number }> = {
  quoted:        { label: 'Quoted',              color: 'text-gray-600',    bg: 'bg-gray-100',    step: 1 },
  deposit_paid:  { label: '🔧 Ready for Prod',  color: 'text-blue-700',   bg: 'bg-blue-100',   step: 2 },
  in_production: { label: 'In Production',       color: 'text-purple-700', bg: 'bg-purple-100', step: 3 },
  installation:  { label: 'Installation',        color: 'text-orange-700', bg: 'bg-orange-100', step: 4 },
  completed:     { label: '✓ Completed',         color: 'text-green-700',  bg: 'bg-green-100',  step: 5 },
  invoiced:      { label: 'Invoiced',            color: 'text-teal-700',   bg: 'bg-teal-100',   step: 6 },
}

const PIPELINE_STEPS: ProjectStatus[] = ['quoted','deposit_paid','in_production','installation','completed','invoiced']

interface Project {
  id: string
  name: string
  client_id: string | null
  quote_id: string | null
  invoice_id: string | null
  status: ProjectStatus
  total_amount: number | null
  service_description: string | null
  notes: string | null
  start_date: string | null
  end_date: string | null
  deposit_paid_at: string | null
  final_paid_at: string | null
  created_at: string
  client?: { name: string; company: string | null }
  quote?: { quote_number: string } | null
  invoice?: { invoice_number: string; status: string } | null
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => { loadProjects() }, [])

  async function loadProjects() {
    setLoading(true)
    // Load bare projects first to avoid FK ambiguity (HTTP 300) with joins
    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (!projectsData) { setLoading(false); return }

    // Enrich each project with related data separately
    const enriched = await Promise.all(
      projectsData.map(async (project) => {
        const [clientRes, quoteRes, invoiceRes] = await Promise.all([
          project.client_id
            ? supabase.from('clients').select('name,company').eq('id', project.client_id).single()
            : Promise.resolve({ data: null }),
          project.quote_id
            ? supabase.from('quotes').select('quote_number').eq('id', project.quote_id).single()
            : Promise.resolve({ data: null }),
          project.invoice_id
            ? supabase.from('invoices').select('invoice_number,status').eq('id', project.invoice_id).single()
            : Promise.resolve({ data: null }),
        ])
        return {
          ...project,
          client: clientRes.data || null,
          quote: quoteRes.data || null,
          invoice: invoiceRes.data || null,
        }
      })
    )
    setProjects(enriched as Project[])
    setLoading(false)
  }

  async function updateStatus(id: string, status: ProjectStatus) {
    await supabase.from('projects').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setProjects(p => p.map(proj => proj.id === id ? { ...proj, status } : proj))
  }

  const filtered = useMemo(() => projects.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.client?.name || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || p.status === filterStatus
    return matchSearch && matchStatus
  }), [projects, search, filterStatus])

  const stats = useMemo(() => ({
    total: projects.length,
    active: projects.filter(p => !['completed','invoiced'].includes(p.status)).length,
    readyForProd: projects.filter(p => p.status === 'deposit_paid').length,
    completed: projects.filter(p => p.status === 'completed').length,
    totalValue: projects.reduce((s, p) => s + (p.total_amount || 0), 0),
  }), [projects])

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading projects...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <FolderOpen size={26} className="text-orange-500"/> Projects
            </h1>
            <p className="text-gray-500 mt-1">Production pipeline — Infinity Wrap Design</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total',          value: stats.total,                      color: 'text-gray-900' },
            { label: 'Active',         value: stats.active,                     color: 'text-blue-600' },
            { label: 'Ready for Prod', value: stats.readyForProd,               color: 'text-purple-600' },
            { label: 'Completed',      value: stats.completed,                  color: 'text-green-600' },
            { label: 'Total Value',    value: formatCurrency(stats.totalValue), color: 'text-orange-500' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-gray-400 text-xs mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Pipeline overview */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-6">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Pipeline Overview</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {PIPELINE_STEPS.map((step, i) => {
              const count = projects.filter(p => p.status === step).length
              const cfg = STATUS_CONFIG[step]
              return (
                <div key={step} className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setFilterStatus(filterStatus === step ? 'all' : step)}
                    className={`flex flex-col items-center px-3 py-2 rounded-lg transition-colors cursor-pointer border ${filterStatus === step ? 'border-gray-900 bg-gray-900 text-white' : `${cfg.bg} ${cfg.color} border-transparent hover:border-gray-300`}`}>
                    <span className="text-lg font-black">{count}</span>
                    <span className="text-xs font-semibold whitespace-nowrap">{cfg.label.replace('🔧 ','').replace('✓ ','')}</span>
                  </button>
                  {i < PIPELINE_STEPS.length - 1 && <ChevronRight size={14} className="text-gray-300 flex-shrink-0"/>}
                </div>
              )
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
        </div>

        {/* Projects list */}
        {filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <FolderOpen size={44} className="mx-auto text-gray-300 mb-4"/>
            <p className="text-gray-500 text-lg font-medium">No projects yet</p>
            <p className="text-gray-400 text-sm mt-1">Create a quote and click "Convert to Project" to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(project => {
              const cfg = STATUS_CONFIG[project.status]
              return (
                <div key={project.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                  <div className="flex items-start gap-4">
                    {/* Step indicator */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-lg ${cfg.bg} ${cfg.color}`}>
                      {cfg.step}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-gray-900">{project.name}</h3>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <p className="text-gray-500 text-sm">{project.client?.name}{project.client?.company ? ` · ${project.client.company}` : ''}</p>
                      {project.service_description && (
                        <p className="text-gray-400 text-xs mt-1">{project.service_description}</p>
                      )}

                      {/* Linked documents */}
                      <div className="flex gap-3 mt-2">
                        {project.quote && (
                          <button onClick={() => router.push(`/quotes/${project.quote_id}`)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
                            <FileText size={11}/>{project.quote.quote_number}
                          </button>
                        )}
                        {project.invoice && (
                          <button onClick={() => router.push(`/invoices/${project.invoice_id}`)}
                            className={`flex items-center gap-1 text-xs font-medium ${project.invoice.status === 'paid' ? 'text-green-600 hover:text-green-800' : 'text-orange-600 hover:text-orange-800'}`}>
                            <Receipt size={11}/>{project.invoice.invoice_number}
                            {project.invoice.status === 'paid' ? ' ✓' : project.invoice.status === 'deposit_paid' ? ' (dep ✓)' : ''}
                          </button>
                        )}
                      </div>

                      {/* Timeline */}
                      {(project.deposit_paid_at || project.start_date) && (
                        <div className="flex gap-4 mt-2 text-xs text-gray-400">
                          {project.start_date && <span>Start: {new Date(project.start_date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>}
                          {project.deposit_paid_at && <span>Deposit: {new Date(project.deposit_paid_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>}
                          {project.final_paid_at && <span>Paid: {new Date(project.final_paid_at).toLocaleDateString('en-US', { month:'short', day:'numeric' })}</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0 flex flex-col items-end gap-2">
                      {project.total_amount && (
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(project.total_amount)}</p>
                      )}
                      <select value={project.status}
                        onChange={e => updateStatus(project.id, e.target.value as ProjectStatus)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400 cursor-pointer">
                        {PIPELINE_STEPS.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label.replace('🔧 ','').replace('✓ ','')}</option>
                        ))}
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

