'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { ArrowLeft, FileText, Receipt, Edit2, Save, X } from 'lucide-react'

const STATUS_PIPELINE = ['quoted','deposit_paid','in_production','installation','completed','invoiced']
const STATUS_LABELS: Record<string, string> = {
  quoted: 'Quoted', deposit_paid: '🔧 Ready for Production',
  in_production: 'In Production', installation: 'Installation',
  completed: '✓ Completed', invoiced: 'Invoiced'
}
const STATUS_COLORS: Record<string, string> = {
  quoted: 'bg-gray-100 text-gray-700', deposit_paid: 'bg-blue-100 text-blue-700',
  in_production: 'bg-purple-100 text-purple-700', installation: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700', invoiced: 'bg-teal-100 text-teal-700',
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    supabase.from('projects')
      .select('*, client:clients(*), quote:quotes(quote_number,total,status), invoice:invoices(invoice_number,total,status,balance_due)')
      .eq('id', id).single()
      .then(({ data }) => {
        if (data) { setProject(data); setNotes(data.notes || '') }
        setLoading(false)
      })
  }, [id])

  async function updateStatus(status: string) {
    await supabase.from('projects').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setProject((p: any) => ({ ...p, status }))
  }

  async function saveNotes() {
    setSaving(true)
    await supabase.from('projects').update({ notes, updated_at: new Date().toISOString() }).eq('id', id)
    setProject((p: any) => ({ ...p, notes }))
    setSaving(false)
    setEditing(false)
  }

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading project...</div>
  if (!project) return (
    <div className="flex flex-col items-center justify-center h-screen text-gray-400 gap-4">
      <p>Project not found</p>
      <button onClick={() => router.push('/projects')} className="text-orange-500 font-semibold">← Back to Projects</button>
    </div>
  )

  const cfg = STATUS_COLORS[project.status] || 'bg-gray-100 text-gray-700'
  const currentStep = STATUS_PIPELINE.indexOf(project.status)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.push('/projects')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft size={20}/>
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
            <p className="text-gray-500 text-sm">{project.client?.name}{project.client?.company ? ` · ${project.client.company}` : ''}</p>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${cfg}`}>{STATUS_LABELS[project.status] || project.status}</span>
        </div>

        {/* Pipeline progress */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Pipeline Stage</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STATUS_PIPELINE.map((step, i) => (
              <div key={step} className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => updateStatus(step)}
                  className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-semibold transition-colors border ${
                    step === project.status
                      ? 'bg-orange-500 text-white border-orange-500'
                      : i < currentStep
                        ? 'bg-green-50 text-green-700 border-green-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-orange-300'
                  }`}>
                  {i < currentStep ? '✓' : i + 1}
                  <span className="mt-0.5 whitespace-nowrap">{STATUS_LABELS[step].replace('🔧 ','').replace('✓ ','')}</span>
                </button>
                {i < STATUS_PIPELINE.length - 1 && <div className={`w-4 h-0.5 flex-shrink-0 ${i < currentStep ? 'bg-green-300' : 'bg-gray-200'}`}/>}
              </div>
            ))}
          </div>
        </div>

        {/* Info cards */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {project.total_amount && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Project Value</p>
              <p className="text-2xl font-black text-gray-900">{formatCurrency(project.total_amount)}</p>
            </div>
          )}
          {project.start_date && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-400 mb-1">Start Date</p>
              <p className="text-lg font-bold text-gray-700">{new Date(project.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          )}
        </div>

        {/* Linked documents */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Linked Documents</p>
          <div className="space-y-2">
            {project.quote && (
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-500"/>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{project.quote.quote_number}</p>
                    <p className={`text-xs font-medium capitalize ${project.quote.status === 'approved' ? 'text-green-600' : 'text-gray-500'}`}>{project.quote.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-bold text-gray-700">{formatCurrency(project.quote.total)}</p>
                  <button onClick={() => router.push(`/quotes/${project.quote_id}`)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold">View →</button>
                </div>
              </div>
            )}
            {project.invoice && (
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-orange-500"/>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{project.invoice.invoice_number}</p>
                    <p className={`text-xs font-medium ${project.invoice.status === 'paid' ? 'text-green-600' : project.invoice.status === 'deposit_paid' ? 'text-orange-600' : 'text-gray-500'}`}>
                      {project.invoice.status === 'paid' ? 'Paid in full ✓' : project.invoice.status === 'deposit_paid' ? 'Deposit paid ✓' : project.invoice.status}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-700">{formatCurrency(project.invoice.total)}</p>
                    {project.invoice.balance_due > 0 && <p className="text-xs text-orange-500">Balance: {formatCurrency(project.invoice.balance_due)}</p>}
                  </div>
                  <button onClick={() => router.push(`/invoices/${project.invoice_id}`)}
                    className="text-xs text-orange-600 hover:text-orange-800 font-semibold">View →</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Service description */}
        {project.service_description && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Services</p>
            <p className="text-sm text-gray-700">{project.service_description}</p>
          </div>
        )}

        {/* Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes</p>
            {editing
              ? <div className="flex gap-2">
                  <button onClick={saveNotes} disabled={saving} className="flex items-center gap-1 text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg font-semibold">
                    <Save size={11}/>{saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => { setEditing(false); setNotes(project.notes || '') }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><X size={14}/></button>
                </div>
              : <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"><Edit2 size={14}/></button>
            }
          </div>
          {editing
            ? <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
            : <p className="text-sm text-gray-600 whitespace-pre-line">{project.notes || <span className="text-gray-300 italic">No notes yet. Click edit to add.</span>}</p>
          }
        </div>

      </div>
    </div>
  )
}
