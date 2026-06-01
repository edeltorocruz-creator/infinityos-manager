'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, QuoteItem, ServiceType, VehicleType, Complexity, Material } from '@/types'
import {
  getPricingRule, calculateItemPrice, calculateQuoteTotals,
  generateQuoteNumber, formatCurrency, TAX_RATE, VALID_DAYS_DEFAULT,
  SERVICE_LABELS, VEHICLE_LABELS, COMPLEXITY_LABELS,
  FLAT_SURFACE_SERVICES, VEHICLE_SERVICES, getFallbackPrice, isSqFtService
} from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react'

const MATERIALS: Material[] = ['3M', 'Avery', 'GF']
const COMPLEXITIES: Complexity[] = ['simple', 'medium', 'complex']
const VEHICLE_OPTIONS: VehicleType[] = ['car', 'suv', 'truck', 'van', 'trailer', 'food_truck']

const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
const labelClass = "text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block"

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
  const prevServiceRef = useRef(serviceType)
  const totals = calculateQuoteTotals(items)

  useEffect(() => {
    supabase.from('clients').select('*').order('name').then(({ data }) => {
      if (data) setClients(data as Client[])
    })
  }, [])

  // When service type changes: reset sq_ft, manualPrice, and fix vehicleType
  // Use ref to avoid re-triggering
  useEffect(() => {
    if (prevServiceRef.current !== serviceType) {
      prevServiceRef.current = serviceType
      setManualPrice('')
      setSqFt('')
      const nowFlat = FLAT_SURFACE_SERVICES.includes(serviceType)
      if (nowFlat) setVehicleType('any' as VehicleType)
      else setVehicleType('truck')
    }
  }, [serviceType])

  // Compute preview price (no async, no state changes)
  function getPreviewPrice(): number {
    if (manualPrice !== '' && typeof manualPrice === 'number') return manualPrice
    const vt = isFlatSurface ? 'any' : vehicleType
    const sqFtVal = typeof sqFt === 'number' ? sqFt : 0
    if (isFlatSurface && !sqFtVal) return 0
    const p = getFallbackPrice(serviceType, vt, complexity, material)
    if (isFlatSurface) return Math.round(p * sqFtVal * 100) / 100
    return p
  }

  const previewPrice = getPreviewPrice()

  async function addItem() {
    setError('')
    if (isFlatSurface && !sqFt) {
      setError('Please enter the square footage for this service.')
      return
    }

    const vt: VehicleType = isFlatSurface ? 'any' as VehicleType : vehicleType
    const sqFtVal = typeof sqFt === 'number' ? sqFt : undefined
    const manualVal = typeof manualPrice === 'number' ? manualPrice : undefined

    let unit_price = 0
    let discount_pct = 0
    let finalSubtotal = 0

    if (manualVal && manualVal > 0) {
      unit_price = manualVal
      finalSubtotal = manualVal * quantity
    } else {
      const rule = await getPricingRule(serviceType, vt, complexity, material)
      const calc = calculateItemPrice(rule, quantity, sqFtVal, undefined, serviceType, vt, complexity, material)
      unit_price = calc.unit_price
      discount_pct = calc.discount_pct
      finalSubtotal = calc.subtotal
    }

    if (unit_price <= 0) {
      setError('Could not calculate a price. Use the manual price field.')
      return
    }

    const description = itemDescription ||
      `${COMPLEXITY_LABELS[complexity]?.split('—')[0]?.trim() || complexity}${sqFtVal ? ` · ${sqFtVal} sq ft` : ''}`

    const newItem: QuoteItem = {
      service_type: serviceType,
      vehicle_type: vt,
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
    setSuccess(`✓ Added: ${SERVICE_LABELS[serviceType]}${vt !== 'any' ? ' — ' + VEHICLE_LABELS[vt] : ''}`)
    setTimeout(() => setSuccess(''), 3000)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItemPrice(index: number, newPrice: number) {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, unit_price: newPrice, subtotal: Math.round(newPrice * item.quantity * 100) / 100 } : item
    ))
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
      setError('Error saving: ' + (saveErr?.message || 'Unknown error'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">

        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/quotes')} className="p-2 hover:bg-gray-200 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
            <p className="text-gray-500 text-sm">Infinity Wrap Design</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
            <AlertCircle size={16} />{error}
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
            <CheckCircle size={16} />{success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* CLIENT SELECT */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Client</h2>
              <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className={inputClass} style={{colorScheme:'light'}}>
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
                ))}
              </select>
              {clients.length === 0 && (
                <p className="text-xs text-orange-500 mt-2">No clients yet. <a href="/clients" className="underline font-medium">Add one first →</a></p>
              )}
            </div>

            {/* SERVICE ITEM FORM */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-5">Add Service Item</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Service</label>
                  <select value={serviceType} onChange={e => setServiceType(e.target.value as ServiceType)} className={inputClass} style={{colorScheme:'light'}}>
                    <optgroup label="─── Vehicle Services ───">
                      {VEHICLE_SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                    </optgroup>
                    <optgroup label="─── Flat Surfaces ───">
                      {FLAT_SURFACE_SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                    </optgroup>
                  </select>
                </div>

                {isFlatSurface ? (
                  <div>
                    <label className={labelClass}>Square Feet <span className="text-red-500">*</span></label>
                    <input type="number" min={1} value={sqFt} onChange={e => setSqFt(e.target.value ? Number(e.target.value) : '')} placeholder="e.g. 200" className={inputClass} />
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Vehicle</label>
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value as VehicleType)} className={inputClass} style={{colorScheme:'light'}}>
                      {VEHICLE_OPTIONS.map(v => <option key={v} value={v}>{VEHICLE_LABELS[v]}</option>)}
                    </select>
                  </div>
                )}

                <div>
                  <label className={labelClass}>Complexity</label>
                  <select value={complexity} onChange={e => setComplexity(e.target.value as Complexity)} className={inputClass} style={{colorScheme:'light'}}>
                    <option value="simple">Simple — Solid colors, basic design</option>
                    <option value="medium">Medium — Custom graphics, moderate detail</option>
                    <option value="complex">Complex — Full custom artwork, intricate</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Material</label>
                  <select value={material} onChange={e => setMaterial(e.target.value as Material)} className={inputClass} style={{colorScheme:'light'}}>
                    <option value="3M">3M — Premium (5-7 yr warranty)</option>
                    <option value="Avery">Avery — Pro (4-6 yr warranty)</option>
                    <option value="GF">GF — Standard (3-5 yr warranty)</option>
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))} className={inputClass} />
                </div>

                <div>
                  <label className={labelClass}>Price Override <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="number" value={manualPrice} onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : '')} placeholder="Auto-calculated if blank" className={inputClass} />
                </div>
              </div>

              <div className="mb-5">
                <label className={labelClass}>Description <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={itemDescription} onChange={e => setItemDescription(e.target.value)} placeholder="e.g. Full color brand wrap with logo" className={inputClass} />
              </div>

              {/* PRICE PREVIEW + ADD BUTTON */}
              <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-5 py-4">
                <div>
                  <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">Auto Price</p>
                  {previewPrice > 0 ? (
                    <div>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(previewPrice)}</p>
                      {quantity > 1 && !isFlatSurface && (
                        <p className="text-sm text-orange-400">× {quantity} = {formatCurrency(previewPrice * quantity)}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">{isFlatSurface ? 'Enter sq ft above' : 'Select options above'}</p>
                  )}
                </div>
                <button onClick={addItem} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-6 py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">
                  <Plus size={18} />
                  Add Item
                </button>
              </div>
            </div>

            {/* ITEMS LIST */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">Quote Items <span className="text-gray-400 font-normal text-sm">({items.length})</span></h2>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">
                          {SERVICE_LABELS[item.service_type]}
                          {item.vehicle_type !== 'any' && ` — ${VEHICLE_LABELS[item.vehicle_type]}`}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {item.complexity} · {item.material} · qty {item.quantity}
                          {item.sq_ft ? ` · ${item.sq_ft} sq ft` : ''}
                        </p>
                        {item.discount_pct > 0 && (
                          <p className="text-green-600 text-xs font-semibold mt-0.5">Fleet {item.discount_pct}% discount applied</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="text-xs text-gray-400 text-center mb-1">Unit $</p>
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={e => updateItemPrice(index, Number(e.target.value))}
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                          />
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-400 mb-1">Total</p>
                          <p className="font-bold text-gray-900 text-sm">{formatCurrency(item.subtotal)}</p>
                        </div>
                        <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Notes</h2>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Timeline, special instructions, deposit details..." className={inputClass} style={{resize:'none'}} />
            </div>
          </div>

          {/* SUMMARY */}
          <div>
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm sticky top-6">
              <h2 className="font-semibold text-gray-900 mb-5">Quote Summary</h2>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Items</span><span className="font-medium text-gray-800">{items.length}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="font-medium text-gray-800">{formatCurrency(totals.subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Tax (NC 6.75%)</span><span className="font-medium text-gray-800">{formatCurrency(totals.tax_amount)}</span></div>
                <div className="flex justify-between pt-3 border-t border-gray-100">
                  <span className="font-bold text-gray-900 text-lg">Total</span>
                  <span className="font-bold text-orange-500 text-lg">{formatCurrency(totals.total)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <button onClick={() => saveQuote('draft')} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition-colors disabled:opacity-50">
                  <Save size={16} />Save as Draft
                </button>
                <button onClick={() => saveQuote('sent')} disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save & Mark Sent'}
                </button>
              </div>
              <div className="mt-5 p-3 bg-blue-50 rounded-xl">
                <p className="text-xs font-bold text-blue-600 mb-1">Payment Terms</p>
                <p className="text-xs text-blue-500">50% deposit to schedule</p>
                <p className="text-xs text-blue-500">50% balance on completion</p>
                <p className="text-xs text-blue-500">Valid 30 days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
