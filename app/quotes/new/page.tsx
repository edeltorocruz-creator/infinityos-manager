'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getActiveConfig, type ServiceDef } from '@/lib/business-config'
import { TAX_RATE, DEPOSIT_RATE, formatCurrency, generateQuoteNumber } from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react'

interface LineItem {
  id: string
  serviceId: string
  label: string
  description: string
  qty: number
  unit: string
  unitPrice: number
  subtotal: number
}

function makeItem(svc: ServiceDef): LineItem {
  return { id: crypto.randomUUID(), serviceId: svc.id, label: svc.label, description: '', qty: 1, unit: svc.unit, unitPrice: svc.defaultPrice, subtotal: svc.defaultPrice }
}

function calcTotals(items: LineItem[]) {
  const sub = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
  const tax = Math.round(sub * TAX_RATE * 100) / 100
  const total = Math.round((sub + tax) * 100) / 100
  const dep = Math.round(total * DEPOSIT_RATE * 100) / 100
  return { subtotal: sub, tax, total, deposit: dep, balance: Math.round((total - dep) * 100) / 100 }
}

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"

function QuoteForm() {
  const router   = useRouter()
  const params   = useSearchParams()
  const config   = getActiveConfig()
  const clientIdRef = useRef(params.get('clientId') || '')
  const notesRef    = useRef('')
  const [clients, setClients] = useState<any[]>([])
  const [items,   setItems]   = useState<LineItem[]>([])
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const categories = Array.from(new Set(config.services.map(s => s.category)))
  const totals = calcTotals(items)

  useEffect(() => {
    supabase.from('clients').select('id,name,company').order('name').then(({ data }) => { if (data) setClients(data) })
  }, [])

  function addService(svc: ServiceDef) { setItems(prev => [...prev, makeItem(svc)]) }
  function addCustom() { setItems(prev => [...prev, { id: crypto.randomUUID(), serviceId: 'custom', label: 'Custom Service', description: '', qty: 1, unit: 'flat', unitPrice: 0, subtotal: 0 }]) }

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map(item => {
      if (item.id !== id) return item
      const u = { ...item, [field]: value }
      if (field === 'qty' || field === 'unitPrice') u.subtotal = Math.round(Number(u.qty) * Number(u.unitPrice) * 100) / 100
      return u
    }))
  }

  async function saveQuote(status: 'draft' | 'sent') {
    const cid = clientIdRef.current
    if (!cid) { setError('Select a client first'); return }
    if (items.length === 0) { setError('Add at least one service'); return }
    setSaving(true); setError('')
    const qNum = await generateQuoteNumber()
    const { data, error: err } = await supabase.from('quotes').insert({
      quote_number: qNum, client_id: cid, status,
      subtotal: totals.subtotal, tax: totals.tax, total: totals.total,
      deposit_amount: totals.deposit, balance_due: totals.balance,
      notes: notesRef.current, line_items: items,
      terms: config.quoteTerms,
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    }).select().single()
    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/quotes/${data.id}`)
  }

  // Expose for testing
  if (typeof window !== 'undefined') {
    (window as any).__saveQuoteDraft = () => saveQuote('draft')
    ;(window as any).__getQuoteState = () => ({ clientId: clientIdRef.current, items, totals })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/quotes')} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">New Quote</h1>
          <p className="text-xs text-gray-500">{config.name}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <button onClick={() => saveQuote('draft')} disabled={saving} className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Save Draft</button>
          <button onClick={() => saveQuote('sent')} disabled={saving} className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"><Save className="w-4 h-4" /> Save & Send</button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Client</h2>
            <select
              defaultValue={clientIdRef.current}
              onChange={e => { clientIdRef.current = e.target.value }}
              className={inp}
            >
              <option value="">— Select client —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ''}</option>)}
            </select>
            <button onClick={() => router.push('/clients?new=1')} className="mt-2 text-xs text-orange-500 hover:text-orange-600 font-medium">+ Add new client</button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
            <textarea
              defaultValue=""
              onChange={e => { notesRef.current = e.target.value }}
              rows={4} placeholder="Job notes, scope details..."
              className={inp + ' resize-none'}
            />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Tax (6.75%)</span><span>{formatCurrency(totals.tax)}</span></div>
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t"><span>Total</span><span>{formatCurrency(totals.total)}</span></div>
            <div className="flex justify-between text-sm text-orange-600 font-semibold"><span>Deposit (50%)</span><span>{formatCurrency(totals.deposit)}</span></div>
            <div className="flex justify-between text-sm text-gray-600"><span>Balance due</span><span>{formatCurrency(totals.balance)}</span></div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}
        </div>

        <div className="col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Add Services</h2>
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {config.services.filter(s => s.category === cat).map(svc => (
                      <button key={svc.id} onClick={() => addService(svc)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center gap-1.5">
                        <Plus className="w-3 h-3" />{svc.label}
                        <span className="text-xs text-gray-400 ml-1">{formatCurrency(svc.defaultPrice)}/{svc.unit}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={addCustom} className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1.5"><Plus className="w-3 h-3" /> Custom line item</button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Quote Lines</h2>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="col-span-4">
                      <label className="text-xs text-gray-400 mb-1 block">Service</label>
                      <input value={item.label} onChange={e => updateItem(item.id, 'label', e.target.value)} className={inp} />
                    </div>
                    <div className="col-span-3">
                      <label className="text-xs text-gray-400 mb-1 block">Description</label>
                      <input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} className={inp} placeholder="Details..." />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400 mb-1 block">Qty</label>
                      <input
                        type="number" value={item.qty} min={0.5} step={0.5}
                        onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value) || 1)}
                        className={inp}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-400 mb-1 block">Unit Price</label>
                      <input
                        type="number" value={item.unitPrice} min={0} step={0.01}
                        onChange={e => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className={inp}
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="text-xs text-gray-400 mb-1 block">Total</label>
                      <p className="text-sm font-semibold text-gray-900 pt-2">{formatCurrency(item.subtotal)}</p>
                    </div>
                    <div className="col-span-1 flex justify-end pt-6">
                      <button onClick={() => setItems(p => p.filter(i => i.id !== item.id))} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm">Click a service above to add it to the quote</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewQuotePage() { return <Suspense><QuoteForm /></Suspense> }
