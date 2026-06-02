'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  calcVehicleSqFt, calcVehicleSubtotal, calcFlatSurface, calcTotals,
  loadAllPricingRules, generateQuoteNumber, formatCurrency, formatDate,
  VEHICLE_SERVICES, FLAT_SERVICES, FEE_SERVICES,
  WARRANTY_TEXT, TERMS_TEXT, TAX_RATE, DEPOSIT_RATE,
  type QuoteLineItem, type PricingRule
} from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft, AlertCircle, CheckCircle, Calculator } from 'lucide-react'

const ic = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
const lb = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block"

export default function NewQuotePage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)

  // Quote header
  const [clientId, setClientId] = useState('')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Current item form
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null)
  const [L, setL] = useState<number | ''>('')
  const [sqft, setSqft] = useState<number | ''>('')
  const [itemDesc, setItemDesc] = useState('')
  const [manualPrice, setManualPrice] = useState<number | ''>('')
  const [itemNotes, setItemNotes] = useState('')

  const prevRuleRef = useRef<string>('')

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').order('name'),
      loadAllPricingRules()
    ]).then(([clientRes, pricingRules]) => {
      if (clientRes.data) setClients(clientRes.data)
      setRules(pricingRules as PricingRule[])
      if (pricingRules.length > 0) setSelectedRule(pricingRules[0] as PricingRule)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedRule) return
    if (prevRuleRef.current !== selectedRule.service_type) {
      prevRuleRef.current = selectedRule.service_type
      setL('')
      setSqft('')
      setManualPrice('')
    }
  }, [selectedRule])

  const isVehicle = selectedRule ? VEHICLE_SERVICES.includes(selectedRule.service_type) : false
  const isFlat = selectedRule ? FLAT_SERVICES.includes(selectedRule.service_type) : false
  const isFee = selectedRule ? FEE_SERVICES.includes(selectedRule.service_type) : false

  // Live preview price
  const preview = (() => {
    if (!selectedRule) return 0
    if (manualPrice !== '') return Number(manualPrice)
    if (isFee) return selectedRule.base_price || 0
    if (isVehicle && L && selectedRule.price_per_sqft && selectedRule.extra_rate != null) {
      const s = calcVehicleSqFt(Number(L), selectedRule.sqft_multiplier_side, selectedRule.sqft_multiplier_top)
      return calcVehicleSubtotal(s, selectedRule.price_per_sqft, selectedRule.extra_rate)
    }
    if (isFlat && sqft && selectedRule.price_per_sqft) {
      return calcFlatSurface(Number(sqft), selectedRule.price_per_sqft)
    }
    return 0
  })()

  const previewSqft = (() => {
    if (!selectedRule || !isVehicle || !L) return null
    return calcVehicleSqFt(Number(L), selectedRule.sqft_multiplier_side, selectedRule.sqft_multiplier_top)
  })()

  function addItem() {
    setError('')
    if (!selectedRule) return
    if (isVehicle && !L) { setError('Enter vehicle length (L) in feet'); return }
    if (isFlat && !sqft) { setError('Enter square footage'); return }
    if (preview <= 0) { setError('Could not calculate price. Enter a manual price.'); return }

    const finalSqft = isVehicle
      ? calcVehicleSqFt(Number(L), selectedRule.sqft_multiplier_side, selectedRule.sqft_multiplier_top)
      : isFlat ? Number(sqft) : 0

    const newItem: QuoteLineItem = {
      id: crypto.randomUUID(),
      service_type: selectedRule.service_type,
      label: selectedRule.label,
      description: itemDesc || selectedRule.label,
      L: isVehicle ? Number(L) : undefined,
      sqft: finalSqft,
      price_per_sqft: selectedRule.price_per_sqft || 0,
      extra_rate: selectedRule.extra_rate || undefined,
      subtotal: manualPrice !== '' ? Number(manualPrice) : preview,
      material_rate: selectedRule.material_rate || undefined,
      labor_rate: selectedRule.labor_rate || undefined,
      notes: itemNotes || undefined,
    }

    setItems(prev => [...prev, newItem])
    setL('')
    setSqft('')
    setItemDesc('')
    setManualPrice('')
    setItemNotes('')
    setSuccess(`✓ Added: ${selectedRule.label}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function updateSubtotal(id: string, val: number) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, subtotal: val } : i))
  }

  const totals = calcTotals(items)

  async function saveQuote(status: 'draft' | 'sent') {
    setError('')
    if (!clientId) { setError('Select a client'); return }
    if (items.length === 0) { setError('Add at least one item'); return }
    setSaving(true)
    const qn = generateQuoteNumber()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    const { data, error: e } = await supabase.from('quotes').insert({
      client_id: clientId,
      quote_number: qn,
      items: items,
      subtotal: totals.subtotal,
      tax_rate: TAX_RATE,
      tax_amount: totals.tax,
      total: totals.total,
      status,
      valid_days: 30,
      expires_at: expires.toISOString(),
      notes: quoteNotes || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    }).select().single()
    setSaving(false)
    if (e) { setError('Error: ' + e.message); return }
    router.push(`/quotes/${data.id}`)
  }

  const vehicleRules = rules.filter(r => VEHICLE_SERVICES.includes(r.service_type))
  const flatRules = rules.filter(r => FLAT_SERVICES.includes(r.service_type))
  const feeRules = rules.filter(r => FEE_SERVICES.includes(r.service_type))

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading pricing...</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/quotes')} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20}/></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
            <p className="text-gray-500 text-sm">Infinity Wrap Design · {formatDate()}</p>
          </div>
        </div>

        {error && <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium"><AlertCircle size={16}/>{error}</div>}
        {success && <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium"><CheckCircle size={16}/>{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">

            {/* CLIENT */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">Client Information</h2>
              <select value={clientId} onChange={e => setClientId(e.target.value)} className={ic} style={{colorScheme:'light'}}>
                <option value="">Select a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
              </select>
              {clients.length === 0 && <p className="text-xs text-orange-500 mt-2">No clients yet. <a href="/clients" className="underline font-semibold">Add one first →</a></p>}
            </div>

            {/* ADD ITEM */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-5">Add Service</h2>

              {/* Service selector tabs */}
              <div className="mb-4">
                <label className={lb}>Service Type</label>
                <div className="space-y-2">
                  {[
                    { title: '🚛 Vehicle Wraps', group: vehicleRules },
                    { title: '🖼️ Flat Surfaces', group: flatRules },
                    { title: '⚙️ Fees', group: feeRules },
                  ].map(({ title, group }) => (
                    <div key={title}>
                      <p className="text-xs text-gray-400 font-semibold mb-1">{title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.map(r => (
                          <button key={r.service_type}
                            onClick={() => setSelectedRule(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selectedRule?.service_type === r.service_type ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'}`}>
                            {r.label}
                            {r.is_default && <span className="ml-1 opacity-60">*</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">* Default market pricing — editable in Admin panel</p>
              </div>

              {/* Dynamic inputs */}
              {selectedRule && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {isVehicle && (
                      <div>
                        <label className={lb}>Vehicle Length — L (feet)</label>
                        <input type="number" min={1} value={L} onChange={e => setL(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 20" className={ic}/>
                        {previewSqft && <p className="text-xs text-gray-400 mt-1">→ {previewSqft} sq ft calculated</p>}
                      </div>
                    )}
                    {isFlat && (
                      <div>
                        <label className={lb}>Square Feet</label>
                        <input type="number" min={1} value={sqft} onChange={e => setSqft(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 100" className={ic}/>
                      </div>
                    )}
                    <div>
                      <label className={lb}>Price Override <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : '')} placeholder="Auto-calculated" className={ic}/>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className={lb}>Description</label>
                    <input type="text" value={itemDesc} onChange={e => setItemDesc(e.target.value)} placeholder={selectedRule.label} className={ic}/>
                  </div>
                  <div className="mb-4">
                    <label className={lb}>Item Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" value={itemNotes} onChange={e => setItemNotes(e.target.value)} placeholder="e.g. Includes 3 free T-shirts with logo" className={ic}/>
                  </div>

                  {/* Price preview + Add button */}
                  <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-5 py-4">
                    <div>
                      <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">
                        <Calculator size={12} className="inline mr-1"/>
                        {isVehicle ? `SqFt = (${L||'L'}×${selectedRule.sqft_multiplier_side})×2 + (${selectedRule.sqft_multiplier_top}×${selectedRule.sqft_multiplier_top})×2` : 'Estimated Price'}
                      </p>
                      {preview > 0
                        ? <p className="text-2xl font-bold text-orange-600">{formatCurrency(preview)}</p>
                        : <p className="text-gray-400 text-sm">{isVehicle ? 'Enter L above' : isFlat ? 'Enter sq ft above' : formatCurrency(selectedRule.base_price || 0)}</p>
                      }
                      {selectedRule.min_price && preview > 0 && preview < selectedRule.min_price && (
                        <p className="text-xs text-red-500 mt-1">⚠ Below minimum of {formatCurrency(selectedRule.min_price)}</p>
                      )}
                    </div>
                    <button onClick={addItem} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors">
                      <Plus size={18}/>Add Item
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ITEMS LIST */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">Quote Items <span className="text-gray-400 font-normal text-sm">({items.length})</span></h2>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                        <p className="text-gray-600 text-xs mt-0.5">{item.description}</p>
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                          {item.L && <span>L: {item.L} ft</span>}
                          {item.sqft > 0 && <span>{item.sqft} sq ft</span>}
                          {item.price_per_sqft > 0 && <span>${item.price_per_sqft}/sqft</span>}
                          {item.extra_rate && <span>+${item.extra_rate}/sqft extra</span>}
                        </div>
                        {item.notes && <p className="text-xs text-gray-400 italic mt-1">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div>
                          <p className="text-xs text-gray-400 text-center mb-1">Subtotal</p>
                          <input type="number" value={item.subtotal}
                            onChange={e => updateSubtotal(item.id, Number(e.target.value))}
                            className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                        </div>
                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NOTES */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">Quote Notes</h2>
              <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} rows={3}
                placeholder="Timeline, special instructions, included items (e.g. 3 free T-shirts with logo)..."
                className={ic} style={{resize:'none'}}/>
            </div>
          </div>

          {/* SUMMARY */}
          <div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm sticky top-6">
              <h2 className="font-bold text-gray-900 mb-5">Quote Summary</h2>
              <div className="space-y-3 mb-5">
                {[
                  { l: 'Items', v: items.length, style: 'text-gray-800' },
                  { l: 'Subtotal', v: formatCurrency(totals.subtotal), style: 'text-gray-800' },
                  { l: 'Tax (NC 6.75%)', v: formatCurrency(totals.tax), style: 'text-gray-800' },
                ].map(r => (
                  <div key={r.l} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.l}</span>
                    <span className={`font-semibold ${r.style}`}>{r.v}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-3 border-t border-gray-100">
                  <span className="font-bold text-gray-900 text-lg">Total</span>
                  <span className="font-bold text-orange-500 text-lg">{formatCurrency(totals.total)}</span>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-orange-700 font-semibold">50% Deposit</span>
                    <span className="text-orange-700 font-bold">{formatCurrency(totals.deposit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Balance Due</span>
                    <span className="text-gray-700 font-semibold">{formatCurrency(totals.balance)}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <button onClick={() => saveQuote('draft')} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50">
                  <Save size={16}/>Save Draft
                </button>
                <button onClick={() => saveQuote('sent')} disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save & Send'}
                </button>
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-600 space-y-1">
                <p className="font-bold">Payment Terms</p>
                <p>• 50% deposit to schedule</p>
                <p>• 50% balance on completion</p>
                <p>• Valid {30} days from today</p>
                <p>• 1-year workmanship warranty</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
