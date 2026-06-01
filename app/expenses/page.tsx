'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { Plus, Search, Receipt, Trash2, Edit2, TrendingDown } from 'lucide-react'

const CATEGORIES = [
  'Materials', 'Equipment', 'Vehicle', 'Labor', 'Marketing',
  'Software', 'Supplies', 'Fuel', 'Insurance', 'Other'
]

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  vendor: string | null
  date: string
  notes: string | null
  receipt_url: string | null
  created_at: string
}

const EMPTY_FORM = { description: '', amount: '', category: 'Materials', vendor: '', date: new Date().toISOString().split('T')[0], notes: '' }

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadExpenses() }, [])

  async function loadExpenses() {
    setLoading(true)
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    if (data) setExpenses(data as Expense[])
    setLoading(false)
  }

  async function saveExpense() {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    const payload = {
      description: form.description, amount: parseFloat(form.amount),
      category: form.category, vendor: form.vendor || null,
      date: form.date, notes: form.notes || null
    }
    if (editing) {
      await supabase.from('expenses').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    loadExpenses()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadExpenses()
  }

  const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse()

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) || (e.vendor || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || e.category === filterCat
    const matchMonth = filterMonth === 'all' || e.date.startsWith(filterMonth)
    return matchSearch && matchCat && matchMonth
  })

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const monthTotal = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((s, e) => s + e.amount, 0)
  const byCategory = CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  const CAT_COLORS: Record<string, string> = {
    Materials: 'bg-blue-100 text-blue-700', Equipment: 'bg-purple-100 text-purple-700',
    Vehicle: 'bg-orange-100 text-orange-700', Labor: 'bg-yellow-100 text-yellow-700',
    Marketing: 'bg-pink-100 text-pink-700', Software: 'bg-indigo-100 text-indigo-700',
    Supplies: 'bg-teal-100 text-teal-700', Fuel: 'bg-red-100 text-red-700',
    Insurance: 'bg-green-100 text-green-700', Other: 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
            <p className="text-gray-500 mt-1">Business expense tracker</p>
          </div>
          <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true) }}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-3 rounded-lg font-semibold transition-colors">
            <Plus size={20} /> Add Expense
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">This Month</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(monthTotal)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Total Records</p>
            <p className="text-2xl font-bold text-gray-900">{expenses.length}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Filtered Total</p>
            <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalFiltered)}</p>
          </div>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <p className="text-gray-500 text-sm">Top Category</p>
            <p className="text-xl font-bold text-gray-900">{byCategory[0]?.cat || '—'}</p>
          </div>
        </div>

        {/* Category breakdown */}
        {byCategory.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Spending by Category</h2>
            <div className="flex flex-wrap gap-3">
              {byCategory.map(({ cat, total }) => (
                <button key={cat} onClick={() => setFilterCat(filterCat === cat ? 'all' : cat)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${filterCat === cat ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[cat]}`}>{cat}</span>
                  <span className="text-gray-700 font-bold">{formatCurrency(total)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-52">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm" />
          </div>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="all">All months</option>
            {months.map(m => <option key={m} value={m}>{new Date(m + '-01').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading expenses...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
            <Receipt size={48} className="mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 text-lg">No expenses found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                  <th className="text-left py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                  <th className="text-right py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="py-3 px-5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr key={e.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                    <td className="py-3 px-5 text-sm text-gray-600">{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                    <td className="py-3 px-5">
                      <p className="text-sm font-medium text-gray-900">{e.description}</p>
                      {e.notes && <p className="text-xs text-gray-400">{e.notes}</p>}
                    </td>
                    <td className="py-3 px-5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${CAT_COLORS[e.category] || 'bg-gray-100 text-gray-700'}`}>{e.category}</span>
                    </td>
                    <td className="py-3 px-5 text-sm text-gray-600">{e.vendor || '—'}</td>
                    <td className="py-3 px-5 text-right font-bold text-gray-900">{formatCurrency(e.amount)}</td>
                    <td className="py-3 px-5">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditing(e); setForm({ description: e.description, amount: e.amount.toString(), category: e.category, vendor: e.vendor || '', date: e.date, notes: e.notes || '' }); setShowForm(true) }}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => deleteExpense(e.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                <tr>
                  <td colSpan={4} className="py-3 px-5 text-sm font-semibold text-gray-700">Total ({filtered.length} records)</td>
                  <td className="py-3 px-5 text-right font-bold text-lg text-red-600">{formatCurrency(totalFiltered)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-5">{editing ? 'Edit Expense' : 'Add Expense'}</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Description *</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. 3M Vinyl Roll — Black"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Amount ($) *</label>
                  <input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Vendor</label>
                  <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })} placeholder="Store / Supplier"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Notes</label>
                <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes"
                  className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={saveExpense} disabled={saving || !form.description.trim() || !form.amount}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-lg font-semibold">
                {saving ? 'Saving...' : (editing ? 'Update' : 'Add Expense')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
