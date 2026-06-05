'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getActiveConfig, type ServiceDef } from '@/lib/business-config'
import { TAX_RATE, DEPOSIT_RATE, formatCurrency, generateQuoteNumber } from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft, Search, CheckCircle } from 'lucide-react'

interface LineItem {
  id: string; serviceId: string; label: string; description: string
  qty: number; unit: string; unitPrice: number; subtotal: number
}

function makeItem(svc: ServiceDef): LineItem {
  return { id: crypto.randomUUID(), serviceId: svc.id, label: svc.label, description: '', qty: 1, unit: svc.unit, unitPrice: svc.defaultPrice, subtotal: svc.defaultPrice }
}

function calcTotals(items: LineItem[]) {
  const sub  = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
  const tax  = Math.round(sub * TAX_RATE * 100) / 100
  const tot  = Math.round((sub + tax) * 100) / 100
  const dep  = Math.round(tot * DEPOSIT_RATE * 100) / 100
  return { subtotal: sub, tax, total: tot, deposit: dep, balance: Math.round((tot - dep) * 100) / 100 }
}

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
const QTY_PRESETS = [1, 10, 25, 50, 100, 200, 500]

function QuoteForm() {
  const router      = useRouter()
  const params      = useSearchParams()
  const config      = getActiveConfig()
  const clientIdRef = useRef(params.get('clientId') || '')
  const notesRef    = useRef('')
  const [clients,      setClients]      = useState<any[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [items,        setItems]        = useState<LineItem[]>([])
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState('')
  const categories = Array.from(new Set(config.services.map(s => s.category)))
  const totals     = calcTotals(items)

  // Filtered clients for search
  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company||'').toLowerCase().includes(clientSearch.toLowerCase())
  )

  useEffect(() => {
    supabase.from('clients').select('id,name,company,phone').order('name').then(({ data }) => {
      if (!data) return
      setClients(data)
      // Auto-select if clientId passed in URL
      if (params.get('clientId')) {
        const c = data.find(c => c.id === params.get('clientId'))
        if (c) setClientSearch(c.name)
      }
    })
  }, [])

  function addService(svc: ServiceDef) {
    setItems(p => [...p, makeItem(svc)])
  }

  function addCustom() {
    setItems(p => [...p, { id: crypto.randomUUID(), serviceId: 'custom', label: 'Custom Service', description: '', qty: 1, unit: 'flat', unitPrice: 0, subtotal: 0 }])
  }

  function removeItem(id: string) { setItems(p => p.filter(i => i.id !== id)) }

  function updateItem(id: string, field: keyof LineItem, value: string | number) {
    setItems(p => p.map(item => {
      if (item.id !== id) return item
      const u = { ...item, [field]: value }
      if (field === 'qty' || field === 'unitPrice')
        u.subtotal = Math.round(Number(u.qty) * Number(u.unitPrice) * 100) / 100
      return u
    }))
  }

  async function saveQuote(status: 'draft' | 'sent') {
    const cid = clientIdRef.current
    if (!cid)             { setError('Select a client first'); return }
    if (items.length===0) { setError('Add at least one service'); return }
    setSaving(true); setError('')

    const qNum    = await generateQuoteNumber()
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()

    const { data, error: err } = await supabase.from('quotes').insert({
      quote_number: qNum, client_id: cid, status,
      items, subtotal: totals.subtotal,
      tax_rate: TAX_RATE, tax_amount: totals.tax,
      total: totals.total, notes: notesRef.current || null,
      expires_at: expires, valid_days: 30,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/quotes/${data.id}`)
  }

  // Expose for QA
  if (typeof window !== 'undefined') {
    (window as any).__saveQuote  = (s = 'draft') => saveQuote(s as any)
    ;(window as any).__setClient = (id: string)  => { clientIdRef.current = id }
    ;(window as any).__getState  = () => ({ client: clientIdRef.current, items, totals })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── HEADER ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/quotes')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">New Quote</h1>
          <p className="text-xs text-gray-400">{config.name}</p>
        </div>
        <div className="ml-auto flex gap-3">
          <button onClick={() => saveQuote('draft')} disabled={saving}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Save Draft
          </button>
          <button onClick={() => saveQuote('sent')} disabled={saving}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save & Send'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-3 gap-5">

        {/* ── LEFT COLUMN ── */}
        <div className="col-span-1 space-y-4">

          {/* Client — searchable */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Client</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Search client..."
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); clientIdRef.current = '' }}
              />
            </div>
            {clientSearch && !clientIdRef.current && filteredClients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
                {filteredClients.slice(0,8).map(c => (
                  <button key={c.id}
                    onClick={() => { clientIdRef.current = c.id; setClientSearch(c.name + (c.company ? ` (${c.company})` : '')) }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-gray-100 last:border-0">
                    <span className="font-medium text-gray-800">{c.name}</span>
                    {c.company && <span className="text-gray-400 ml-1 text-xs">· {c.company}</span>}
                  </button>
                ))}
              </div>
            )}
            {clientIdRef.current && (
              <p className="mt-2 text-xs text-green-600 font-medium flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Client selected
              </p>
            )}
            <button onClick={() => router.push('/clients?new=1')}
              className="mt-2 text-xs text-orange-500 hover:text-orange-600 font-medium">
              + Add new client
            </button>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Notes</h2>
            <textarea defaultValue="" onChange={e => { notesRef.current = e.target.value }}
              rows={3} placeholder="Job details, vehicle info, special instructions..."
              className={inp + ' resize-none text-xs'} />
          </div>

          {/* Totals */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
            {[['Subtotal', totals.subtotal], ['Tax (6.75%)', totals.tax]].map(([l,v]) => (
              <div key={String(l)} className="flex justify-between text-sm text-gray-500">
                <span>{l}</span><span>{formatCurrency(Number(v))}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-gray-900 pt-2 border-t text-base">
              <span>Total</span><span>{formatCurrency(totals.total)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-orange-600">
              <span>Deposit (50%)</span><span>{formatCurrency(totals.deposit)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400">
              <span>Balance</span><span>{formatCurrency(totals.balance)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="col-span-2 space-y-4">

          {/* Service Picker */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-4">Add Services</h2>
            <div className="space-y-4">
              {categories.map(cat => (
                <div key={cat}>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {config.services.filter(s => s.category === cat).map(svc => (
                      <button key={svc.id} onClick={() => addService(svc)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all flex items-center gap-1.5">
                        <Plus className="w-3 h-3" />
                        <span className="font-medium">{svc.label}</span>
                        <span className="text-xs text-gray-300">{formatCurrency(svc.defaultPrice)}/{svc.unit}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <button onClick={addCustom}
                className="px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 hover:border-orange-400 hover:text-orange-600 transition-colors flex items-center gap-1.5">
                <Plus className="w-3 h-3" /> Custom line item
              </button>
            </div>
          </div>

          {/* Line Items */}
          {items.length > 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">Quote Lines</h2>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-lg">
                    <div className="col-span-4">
                      <p className="text-xs text-gray-400 mb-1">Service</p>
                      <input value={item.label} onChange={e => updateItem(item.id,'label',e.target.value)}
                        className={inp} />
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-gray-400 mb-1">Description</p>
                      <input value={item.description} onChange={e => updateItem(item.id,'description',e.target.value)}
                        className={inp} placeholder="Details..." />
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-1">Qty</p>
                      {/* Quick presets */}
                      <select value={item.qty}
                        onChange={e => updateItem(item.id,'qty', parseFloat(e.target.value)||1)}
                        className={inp + ' pr-0'}>
                        {QTY_PRESETS.map(q => <option key={q} value={q}>{q}</option>)}
                        <option value={item.qty} disabled hidden>{item.qty}</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400 mb-1">Unit $</p>
                      <input type="number" value={item.unitPrice} min={0} step={0.01}
                        onChange={e => updateItem(item.id,'unitPrice',parseFloat(e.target.value)||0)}
                        className={inp} />
                    </div>
                    <div className="col-span-1 text-right">
                      <p className="text-xs text-gray-400 mb-1">Total</p>
                      <p className="text-sm font-bold text-gray-900 pt-2">{formatCurrency(item.subtotal)}</p>
                    </div>
                    <div className="col-span-12 flex justify-between items-center mt-1">
                      {/* Qty quick presets for non-standard values */}
                      <div className="flex gap-1">
                        {[1,50,100,200].map(q => (
                          <button key={q} onClick={() => updateItem(item.id,'qty',q)}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${item.qty===q ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-200 text-gray-400 hover:border-orange-300'}`}>
                            {q}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        className="text-xs text-gray-300 hover:text-red-500 flex items-center gap-1">
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
              <Plus className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Click a service above to add it to the quote</p>
              <p className="text-gray-300 text-xs mt-1">You can add multiple services and edit quantities</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewQuotePage() { return <Suspense><QuoteForm /></Suspense> }
