'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, QuoteItem, ServiceType, VehicleType, Complexity, Material } from '@/types'
import {
  getPricingRule, calculateItemPrice, calculateQuoteTotals,
  generateQuoteNumber, formatCurrency, TAX_RATE, VALID_DAYS_DEFAULT,
  SERVICE_LABELS, VEHICLE_LABELS, COMPLEXITY_LABELS,
  FLAT_SURFACE_SERVICES, VEHICLE_SERVICES, getFallbackPrice, isSqFtService
} from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft, Calculator, AlertCircle, CheckCircle } from 'lucide-react'

const MATERIALS: Material[] = ['3M', 'Avery', 'GF']
const COMPLEXITIES: Complexity[] = ['simple', 'medium', 'complex']
const VEHICLE_OPTIONS: VehicleType[] = ['car', 'suv', 'truck', 'van', 'trailer', 'food_truck']

export default function NewQuotePage() {
  const router = useRouter()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [items, setItems] = useState<QuoteItem[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [serviceType, setServiceType] = useState<ServiceType>('full_wrap')
  const [vehicleType, setVehicleType] = useState<VehicleType>('truck')
  const [complexity, setComplexity] = useState<Complexity>('medium')
  const [material, setMaterial] = useState<Material>('3M')
  const [quantity, setQuantity] = useState(1)
  const [sqFt, setSqFt] = useState<number | ''>('')
  const [manualPrice, setManualPrice] = useState<number | ''>('')
  const [itemDescription, setItemDescription] = useState('')

  const isFlatSurface = FLAT_SURFACE_SERVICES.includes(serviceType)
  const totals = calculateQuoteTotals(items)

  // Auto-preview price based on current selections
  const currentAutoPrice = (() => {
    if (manualPrice !== '') return typeof manualPrice === 'number' ? manualPrice : 0
    const vtForLookup = isFlatSurface ? 'any' : vehicleType
    const sqFtVal = typeof sqFt === 'number' ? sqFt : undefined
    if (isFlatSurface && !sqFtVal) return 0
    const fallback = getFallbackPrice(serviceType, vtForLookup, complexity, material)
    if (isFlatSurface && sqFtVal) return Math.round(fallback * sqFtVal * 100) / 100
    return fallback
  })()

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      if (data) setClients(data as Client[])
    })
  }, [])

  useEffect(() => {
    if (isFlatSurface) setVehicleType('any' as VehicleType)
    else if (vehicleType === 'any' as VehicleType) setVehicleType('truck')
    setManualPrice('')
    setSqFt('')
  }, [serviceType])

  async function addItem() {
    setError('')
    if (!serviceType) { setError('Select a service type'); return }
    const isFlatSvc = isFlatSurface
    if (isFlatSvc && !sqFt) { setError('Enter square footage for this service'); return }

    const vtForLookup = isFlatSvc ? 'any' : vehicleType
    const sqFtVal = typeof sqFt === 'number' ? sqFt : undefined
    const manualVal = typeof manualPrice === 'number' ? manualPrice : undefined

    let unit_price = 0
    let discount_pct = 0
    let finalSubtotal = 0

    if (manualVal) {
      unit_price = manualVal
      finalSubtotal = manualVal * quantity
    } else {
      // Try DB first, then fallback
      const rule = await getPricingRule(serviceType, vtForLookup as VehicleType, complexity, material)
      const calc = calculateItemPrice(rule, quantity, sqFtVal, undefined, serviceType, vtForLookup, complexity, material)
      unit_price = calc.unit_price
      discount_pct = calc.discount_pct
      finalSubtotal = calc.subtotal
    }

    if (unit_price <= 0) {
      setError('Could not calculate price. Please enter a manual price.')
      return
    }

    const vehicleLabel = isFlatSvc ? '' : ` — ${VEHICLE_LABELS[vehicleType]}`
    const complexityLabel = COMPLEXITY_LABELS[complexity]?.split('—')[0]?.trim() || complexity
    const description = itemDescription || `${complexityLabel}${sqFtVal ? ` · ${sqFtVal} sq ft` : ''}`

    const newItem: QuoteItem = {
      service_type: serviceType,
      vehicle_type: vtForLookup as VehicleType,
      size_category: 'standard',
      complexity,
      material,
      description,
      quantity,
      unit_price,
      sq_ft: sqFtVal,
      subtotal: finalSubtotal,
      discount_pct,
    }

    setItems(prev => [...prev, newItem])
    setItemDescription('')
    setManualPrice('')
    setSqFt('')
    setQuantity(1)
    setSuccess(`Added: ${SERVICE_LABELS[serviceType]}${vehicleLabel}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItemPrice(index: number, newPrice: number) {
    const updated = [...items]
    updated[index].unit_price = newPrice
    updated[index].subtotal = Math.round(newPrice * updated[index].quantity * 100) / 100
    setItems(updated)
  }

  async function saveQuote(status: 'draft' | 'sent') {
    setError('')
    if (!selectedClientId) { setError('Please select a client'); return }
    if (items.length === 0) { setError('Add at least one service item'); return }

    setSaving(true)
    const quoteNumber = generateQuoteNumber()
    const expires = new Date()
    expires.setDate(expires.getDate() + VALID_DAYS_DEFAULT)

    const { data, error: saveErr } = await supabase.from('quotes').insert({
      client_id: selectedClientId,
      quote_number: quoteNumber,
      items,
      subtotal: totals.subtotal,
      tax_rate: TAX_RATE,
      tax_amount: totals.tax_amount,
      total: totals.total,
      status,
      valid_days: VALID_DAYS_DEFAULT,
      expires_at: expires.toISOString(),
      notes: notes || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    }).select().single()

    setSaving(false)
    if (!saveErr && data) {
      router.push(`/quotes/${data.id}`)
    } else {
      setError('Error saving quote: ' + (saveErr?.message || 'Unknown error'))
    }
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
  const labelClass = "text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block"

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/quotes')} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
            <p className="text-gray-500 text-sm">Infinity Wrap Design</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            <AlertCircle size={16} className="flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            <CheckCircle size={16} className="flex-shrink-0" />
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* CLIENT */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Client</h2>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className={inputClass}
                style={{ colorScheme: 'light' }}
              >
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ''}
                  </option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-orange-500 mt-2">
                  No clients yet. <a href="/clients" className="underline">Add a client first →</a>
                </p>
              )}
            </div>

            {/* ADD SERVICE ITEM */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-5">Add Service Item</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Service Type</label>
                  <select value={serviceType} onChange={e => setServiceType(e.target.value as ServiceType)} className={inputClass} style={{ colorScheme: 'light' }}>
                    <optgroup label="Vehicle Services">
                      {VEHICLE_SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                    </optgroup>
                    <optgroup label="Flat Surfaces">
                      {FLAT_SURFACE_SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                    </optgroup>
                  </select>
                </div>

                {!isFlatSurface ? (
                  <div>
                    <label className={labelClass}>Vehicle Type</label>
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value as VehicleType)} className={inputClass} style={{ colorScheme: 'light' }}>
                      {VEHICLE_OPTIONS.map(v => <option key={v} value={v}>{VEHICLE_LABELS[v]}</option>)}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Square Feet <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      value={sqFt}
                      onChange={e => setSqFt(e.target.value ? Number(e.target.value) : '')}
                      placeholder="e.g. 200"
                      className={inputClass}
                      min={1}
                    />
                  </div>
                )}

                <div>
                  <label className={labelClass}>Complexity</label>
                  <select value={complexity} onChange={e => setComplexity(e.target.value as Complexity)} className={inputClass} style={{ colorScheme: 'light' }}>
                    {COMPLEXITIES.map(c => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Material</label>
                  <select value={material} onChange={e => setMaterial(e.target.value as Material)} className={inputClass} style={{ colorScheme: 'light' }}>
                    {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Manual Price Override <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Leave blank for auto price"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className={labelClass}>Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  placeholder="e.g. Full color brand wrap with logo"
                  className={inputClass}
                />
              </div>

              {/* Live price preview */}
              <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-lg px-4 py-3 mb-4">
                <div>
                  <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Estimated Price</p>
                  <p className="text-xl font-bold text-orange-700">
                    {currentAutoPrice > 0
                      ? isFlatSurface
                        ? sqFt ? formatCurrency(currentAutoPrice) : 'Enter sq ft'
                        : formatCurrency(currentAutoPrice)
                      : '—'
                    }
                    {quantity > 1 && currentAutoPrice > 0 && !isFlatSurface && (
                      <span className="text-sm font-normal text-orange-500 ml-2">× {quantity} = {formatCurrency(currentAutoPrice * quantity)}</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={addItem}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
                >
                  <Plus size={16} />
                  Add Item
                </button>
              </div>
            </div>

            {/* ITEMS LIST */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">Quote Items ({items.length})</h2>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {SERVICE_LABELS[item.service_type]}
                          {item.vehicle_type !== 'any' && ` — ${VEHICLE_LABELS[item.vehicle_type]}`}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {item.complexity} · {item.material} · qty: {item.quantity}
                          {item.sq_ft ? ` · ${item.sq_ft} sq ft` : ''}
                        </p>
                        {item.discount_pct > 0 && (
                          <p className="text-green-600 text-xs font-medium mt-0.5">Fleet discount: {item.discount_pct}% off</p>
                        )}
                        <p className="text-gray-400 text-xs italic mt-0.5">{item.description}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={e => updateItemPrice(index, Number(e.target.value))}
                            className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                          <p className="text-gray-400 text-xs text-right mt-0.5">each</p>
                        </div>
                        <div className="text-right w-24">
                          <p className="font-bold text-gray-900">{formatCurrency(item.subtotal)}</p>
                        </div>
                      </div>
                      <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* NOTES */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Timeline, special instructions, deposit info..."
                className={inputClass}
                style={{ resize: 'none' }}
              />
            </div>
          </div>

          {/* SUMMARY SIDEBAR */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm sticky top-6">
              <h2 className="font-semibold text-gray-900 mb-5">Quote Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items</span>
                  <span className="font-medium text-gray-800">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium text-gray-800">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax (NC 6.75%)</span>
                  <span className="font-medium text-gray-800">{formatCurrency(totals.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-100">
                  <span className="text-gray-900">Total</span>
                  <span className="text-orange-500">{formatCurrency(totals.total)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => saveQuote('draft')}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <Save size={16} />
                  Save as Draft
                </button>
                <button
                  onClick={() => saveQuote('sent')}
                  disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save & Mark as Sent'}
                </button>
              </div>
              <div className="mt-5 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-semibold">Payment Terms</p>
                <p className="text-xs text-blue-500 mt-1">50% deposit to schedule</p>
                <p className="text-xs text-blue-500">50% balance on completion</p>
                <p className="text-xs text-blue-500">Valid for 30 days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
