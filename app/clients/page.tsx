'use client'

export const dynamic = 'force-dynamic'


import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Client } from '@/types'
import { Plus, Search, Phone, Mail, Building2, User, Edit2, Trash2 } from 'lucide-react'

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').order('name')
    if (data) setClients(data as Client[])
    setLoading(false)
  }

  function openNew() {
    setEditing(null)
    setForm({ name: '', email: '', phone: '', company: '', notes: '' })
    setShowForm(true)
  }

  function openEdit(c: Client) {
    setEditing(c)
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', company: c.company || '', notes: (c as any).notes || '' })
    setShowForm(true)
  }

  async function saveClient() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('clients').update({ name: form.name, email: form.email || null, phone: form.phone || null, company: form.company || null, notes: form.notes || null }).eq('id', editing.id)
    } else {
      await supabase.from('clients').insert({ name: form.name, email: form.email || null, phone: form.phone || null, company: form.company || null, notes: form.notes || null })
    }
    setSaving(false)
    setShowForm(false)
    loadClients()
  }

  async function deleteClient(id: string) {
    if (!confirm('Delete this client? This cannot be undone.')) return
    await supabase.from('clients').delete().eq('id', id)
    loadClients()
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-500 mt-1">{clients.length} total clients</p>
          </div>
          <button onClick={openNew} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors">
            <Plus size={20} /> Add Client
          </button>
        </div>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-3.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company or email..."
            className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <User size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">{search ? 'No clients match your search' : 'No clients yet'}</p>
            {!search && <button onClick={openNew} className="text-orange-500 hover:underline mt-2 inline-block">Add your first client →</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-orange-600 font-bold text-sm">{c.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(c)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Edit2 size={15} /></button>
                    <button onClick={() => deleteClient(c.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                  </div>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{c.name}</h3>
                {c.company && <p className="text-gray-500 text-sm flex items-center gap-1.5 mb-1"><Building2 size={13} />{c.company}</p>}
                {c.email && <p className="text-gray-500 text-sm flex items-center gap-1.5 mb-1"><Mail size={13} />{c.email}</p>}
                {c.phone && <p className="text-gray-500 text-sm flex items-center gap-1.5"><Phone size={13} />{c.phone}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editing ? 'Edit Client' : 'New Client'}</h2>
            <div className="space-y-4">
              {[
                { label: 'Full Name *', key: 'name', placeholder: 'John Smith' },
                { label: 'Company', key: 'company', placeholder: 'ABC Corp' },
                { label: 'Email', key: 'email', placeholder: 'john@example.com' },
                { label: 'Phone', key: 'phone', placeholder: '(919) 555-0100' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">{f.label}</label>
                  <input value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Internal notes..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={saveClient} disabled={saving || !form.name.trim()} className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold transition-colors">
                {saving ? 'Saving...' : (editing ? 'Update' : 'Add Client')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
