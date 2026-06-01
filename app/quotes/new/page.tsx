'use client'

export const dynamic = 'force-dynamic'


import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Client, QuoteItem, ServiceType, VehicleType, Complexity, Material } from '@/types'
import {
  getPricingRule, calculateItemPrice, calculateQuoteTotals,
  generateQuoteNumber, formatCurrency, TAX_RATE, VALID_DAYS_DEFAULT,
  SERVICE_LABELS, VEHICLE_LABELS, COMPLEXITY_LABELS,
  FLAT_SURFACE_SERVICES, VEHICLE_SERVICES
} from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft, Calculator } from 'lucide-react'

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
  const [loadingPrice, setLoadingPrice] = useState(false)

  // New item form state
  const [serviceType, setServiceType] = useState<ServiceType>('full_wrap')
  const [vehicleType, setVehicleType] = useState<VehicleType>('truck')
  const [complexity, setComplexity] = useState<Complexity>('medium')
  const [material, setMaterial] = useState<Material>('3M')
  const [quantity, setQuantity] = useState(1)
  const [sqFt, setSqFt] = useState<number | ''>('')
  const [manualPrice, setManualPrice] = useState<number | ''>('')
  const [itemDescription, setItemDescription] = useState('')
  const [previewPrice, setPreviewPrice] = useState<number | null>(null)

  const isFlatSurface = FLAT_SURFACE_SERVICES.includes(serviceType)
  const totals = calculateQuoteTotals(items)

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (serviceType) {
      setVehicleType(isFlatSurface ? 'any' : 'truck')
      setPreviewPrice(null)
      setManualPrice('')
    }
  }, [serviceType])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('*').order('name')
    if (data) setClients(data as Client[])
  }

  async function calculatePreview() {
    setLoadingPrice(true)
    const rule = await getPricingRule(serviceType, vehicleType, complexity, material)
    if (rule) {
      const sqFtVal = typeof sqFt === 'number' ? sqFt : undefined
      const manualVal = typeof manualPrice === 'number' ? manualPrice : undefined
      const { unit_price } = calculateItemPrice(rule, quantity, sqFtVal, manualVal)
      setPreviewPrice(unit_price)
    } else {
      setPreviewPrice(null)
      alert('No pricing rule found for this combination. Enter manual price.')
    }
    setLoadingPrice(false)
  }

  async function addItem() {
    if (!serviceType) return

    const rule = await getPricingRule(serviceType, vehicleType, complexity, material)
    const sqFtVal = typeof sqFt === 'number' ? sqFt : undefined
    const manualVal = typeof manualPrice === 'number' ? manualPrice : undefined

    let unit_price = manualVal ?? 0
    let discount_pct = 0
    let finalSubtotal = 0

    if (rule) {
      const calc = calculateItemPrice(rule, quantity, sqFtVal, manualVal)
      unit_price = calc.unit_price
      discount_pct = calc.discount_pct
      finalSubtotal = calc.subtotal
    } else if (manualVal) {
      unit_price = manualVal
      finalSubtotal = manualVal * quantity
    } else {
      alert('No pricing found. Please enter a manual price.')
      return
    }

    const description = itemDescription ||
      `${COMPLEXITY_LABELS[complexity].split('—')[0].trim()} · ${isFlatSurface ? (sqFtVal ? `${sqFtVal} sq ft` : '') : ''}`

    const newItem: QuoteItem = {
      service_type: serviceType,
      vehicle_type: vehicleType,
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

    setItems([...items, newItem])
    // Reset form
    setItemDescription('')
    setManualPrice('')
    setSqFt('')
    setPreviewPrice(null)
    setQuantity(1)
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index))
  }

  function updateItemPrice(index: number, newPrice: number) {
    const updated = [...items]
    updated[index].unit_price = newPrice
    updated[index].subtotal = newPrice * updated[index].quantity
    setItems(updated)
  }

  async function saveQuote(status: 'draft' | 'sent') {
    if (!selectedClientId) { alert('Please select a client'); return }
    if (items.length === 0) { alert('Add at least one item'); return }

    setSaving(true)
    const quoteNumber = generateQuoteNumber()
    const expires = new Date()
    expires.setDate(expires.getDate() + VALID_DAYS_DEFAULT)

    const { data, error } = await supabase.from('quotes').insert({
      client_id: selectedClientId,
      quote_number: quoteNumber,
      items: items,
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
    if (!error && data) {
      router.push(`/quotes/${data.id}`)
    } else {
      alert('Error saving quote: ' + error?.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        {/* HEADER */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/quotes')}
            className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Quote</h1>
            <p className="text-gray-500 text-sm">Infinity Wrap Design</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN — Form */}
          <div className="lg:col-span-2 space-y-6">

            {/* CLIENT */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-4">Client</h2>
              <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Select a client...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}{c.company ? ` — ${c.company}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* ADD ITEM */}
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
              <h2 className="font-semibold text-gray-900 mb-5">Add Service Item</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Service Type */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Service</label>
                  <select value={serviceType} onChange={e => setServiceType(e.target.value as ServiceType)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    <optgroup label="Vehicle Services">
                      {VEHICLE_SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                    </optgroup>
                    <optgroup label="Flat Surfaces">
                      {FLAT_SURFACE_SERVICES.map(s => <option key={s} value={s}>{SERVICE_LABELS[s]}</option>)}
                    </optgroup>
                  </select>
                </div>

                {/* Vehicle Type — only for vehicles */}
                {!isFlatSurface && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Vehicle</label>
                    <select value={vehicleType} onChange={e => setVehicleType(e.target.value as VehicleType)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                      {VEHICLE_OPTIONS.map(v => <option key={v} value={v}>{VEHICLE_LABELS[v]}</option>)}
                    </select>
                  </div>
                )}

                {/* Sq Ft — only for flat surfaces */}
                {isFlatSurface && (
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Square Feet</label>
                    <input type="number" value={sqFt} onChange={e => setSqFt(Number(e.target.value))}
                      placeholder="e.g. 200"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                  </div>
                )}

                {/* Complexity */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Complexity</label>
                  <select value={complexity} onChange={e => setComplexity(e.target.value as Complexity)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {COMPLEXITIES.map(c => (
                      <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>
                    ))}
                  </select>
                </div>

                {/* Material */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Material</label>
                  <select value={material} onChange={e => setMaterial(e.target.value as Material)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                    {MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Quantity</label>
                  <input type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>

                {/* Manual Price Override */}
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">
                    Manual Price Override
                    <span className="text-gray-300 font-normal ml-1">(optional)</span>
                  </label>
                  <input type="number" value={manualPrice} onChange={e => setManualPrice(Number(e.target.value))}
                    placeholder="Override auto price"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1 block">Description (optional)</label>
                <input type="text" value={itemDescription} onChange={e => setItemDescription(e.target.value)}
                  placeholder="e.g. Full color brand wrap with custom design"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              </div>

              {/* Price Preview + Add Button */}
              <div className="flex items-center gap-3">
                <button onClick={calculatePreview} disabled={loadingPrice}
                  className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
                  <Calculator size={16} />
                  {loadingPrice ? 'Calculating...' : 'Calculate Price'}
                </button>

                {previewPrice !== null && (
                  <span className="bg-orange-50 text-orange-700 font-bold px-4 py-2 rounded-lg text-sm">
                    Unit: {formatCurrency(previewPrice)}
                    {quantity > 1 && ` × ${quantity} = ${formatCurrency(previewPrice * quantity)}`}
                  </span>
                )}

                <button onClick={addItem}
                  className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ml-auto">
                  <Plus size={16} />
                  Add Item
                </button>
              </div>
            </div>

            {/* ITEMS LIST */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                <h2 className="font-semibold text-gray-900 mb-4">Quote Items</h2>
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {SERVICE_LABELS[item.service_type]}
                          {item.vehicle_type !== 'any' && ` — ${VEHICLE_LABELS[item.vehicle_type]}`}
                        </p>
                        <p className="text-gray-400 text-xs">{item.complexity} · {item.material} · qty: {item.quantity}</p>
                        {item.discount_pct > 0 && <p className="text-green-600 text-xs">Fleet discount: {item.discount_pct}%</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={e => updateItemPrice(index, Number(e.target.value))}
                          className="w-28 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                        <span className="text-gray-400 text-xs">each</span>
                      </div>
                      <div className="text-right w-24">
                        <p className="font-bold text-gray-900">{formatCurrency(item.subtotal)}</p>
                      </div>
                      <button onClick={() => removeItem(index)}
                        className="text-red-400 hover:text-red-600 p-1 transition-colors">
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
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                rows={3} placeholder="Additional notes, special instructions, timeline..."
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
            </div>
          </div>

          {/* RIGHT COLUMN — Summary */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm sticky top-6">
              <h2 className="font-semibold text-gray-900 mb-5">Quote Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Items</span>
                  <span className="font-medium">{items.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tax (NC 6.75%)</span>
                  <span className="font-medium">{formatCurrency(totals.tax_amount)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-3 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-orange-500">{formatCurrency(totals.total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={() => saveQuote('draft')} disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-lg font-medium transition-colors">
                  <Save size={16} />
                  Save as Draft
                </button>
                <button onClick={() => saveQuote('sent')} disabled={saving}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold transition-colors">
                  {saving ? 'Saving...' : 'Save & Mark as Sent'}
                </button>
              </div>

              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">Payment Terms</p>
                <p className="text-xs text-blue-500 mt-1">50% deposit · 50% on completion</p>
                <p className="text-xs text-blue-500">Valid for 30 days</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
