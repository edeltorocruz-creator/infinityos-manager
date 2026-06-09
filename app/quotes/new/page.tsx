'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TAX_RATE, DEPOSIT_RATE, formatCurrency, generateQuoteNumber,
  calcSqFt, calcFlatSqFt, getIncludesText,
  MATERIAL_MULTIPLIERS, COMPLEXITY_MULTIPLIERS,
  MATERIAL_LABELS, COMPLEXITY_LABELS,
  VEHICLE_BASE_PRICES, VEHICLE_TYPE_LABELS, WRAP_TYPE_LABELS,
  type SqFtLine, type VehicleLine, type MaterialType, type ComplexityLevel, type WrapType
} from '@/lib/quote-engine'
import { ArrowLeft, Save, Search, CheckCircle, Car, Ruler } from 'lucide-react'

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BASE_SQFT_PRICE = 8.50  // internal — not shown to client

const SQFT_SERVICES_L = [
  { id: 'food_truck', label: 'Food Truck Wrap' },
  { id: 'trailer',    label: 'Trailer Wrap' },
  { id: 'box_truck',  label: 'Box Truck Wrap' },
]
const SQFT_SERVICES_WH = [
  { id: 'wall_mural',      label: 'Wall Mural' },
  { id: 'window_graphics', label: 'Window Graphics' },
  { id: 'storefront',      label: 'Storefront Graphics' },
  { id: 'banner',          label: 'Banner / Sign' },
  { id: 'floor_graphics',  label: 'Floor Graphics' },
  { id: 'perforated',      label: 'Perforated Vinyl' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function buildSqFtLine(id: string, label: string, mode: 'L' | 'WH'): SqFtLine {
  const isPrinted = true
  return {
    id, mode, label, description: '',
    sqft: 0, pricePerSqft: BASE_SQFT_PRICE,
    material: 'avery', complexity: 'simple',
    isPrinted, hasDesign: true, hasLamination: isPrinted,
    subtotal: 0,
    includesText: getIncludesText({ isPrinted, hasDesign: true, hasLamination: true, hasChromeDelete: false, hasColorChange: false }),
  }
}

function recalcSqFtLine(l: SqFtLine): SqFtLine {
  const sqft = l.mode === 'L'
    ? calcSqFt(l.L ?? 0)
    : calcFlatSqFt(l.W ?? 0, l.H ?? 0)
  const mat  = MATERIAL_MULTIPLIERS[l.material] ?? 1
  const comp = COMPLEXITY_MULTIPLIERS[l.complexity] ?? 1
  const lam  = l.hasLamination ? 1.15 : 1
  const des  = l.hasDesign ? 1.08 : 1
  const subtotal = Math.round(sqft * l.pricePerSqft * mat * comp * lam * des * 100) / 100
  const includesText = getIncludesText({
    isPrinted: l.isPrinted, hasDesign: l.hasDesign,
    hasLamination: l.hasLamination, hasChromeDelete: false, hasColorChange: false,
  })
  return { ...l, sqft, subtotal, includesText }
}

function recalcVehicleLine(l: VehicleLine): VehicleLine {
  const base = VEHICLE_BASE_PRICES[l.vehicleType]?.[l.wrapType] ?? 0
  const mat  = MATERIAL_MULTIPLIERS[l.material] ?? 1
  const comp = COMPLEXITY_MULTIPLIERS[l.complexity] ?? 1
  let addons = 0
  if (l.colorChange)  addons += 500
  if (l.printedWrap)  addons += 300
  if (l.chromeDelete) addons += 300
  if (l.hasDesign)    addons += 250
  const subtotal = Math.round((base * mat * comp) + addons * 100) / 100
  const includesText = getIncludesText({
    isPrinted: l.printedWrap, hasDesign: l.hasDesign,
    hasLamination: l.printedWrap, hasChromeDelete: l.chromeDelete,
    hasColorChange: l.colorChange,
  })
  return { ...l, subtotal, includesText }
}

function calcTotals(sqftLines: SqFtLine[], vehicleLines: VehicleLine[]) {
  const all = [...sqftLines.map(l => l.subtotal), ...vehicleLines.map(l => l.subtotal)]
  const subtotal = Math.round(all.reduce((a, b) => a + b, 0) * 100) / 100
  const tax      = Math.round(subtotal * TAX_RATE * 100) / 100
  const total    = Math.round((subtotal + tax) * 100) / 100
  const deposit  = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  return { subtotal, tax, total, deposit, balance }
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
const sel = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"

// ─── SQ FT CARD ───────────────────────────────────────────────────────────────
function SqFtCard({ line, onChange, onRemove }: {
  line: SqFtLine
  onChange: (id: string, u: Partial<SqFtLine>) => void
  onRemove: (id: string) => void
}) {
  function upd(u: Partial<SqFtLine>) { onChange(line.id, u) }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-800">{line.label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{line.includesText}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-orange-600">{formatCurrency(line.subtotal)}</span>
          <button onClick={() => onRemove(line.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {line.mode === 'L' ? (
          <>
            <div>
              <p className="text-xs text-gray-400 mb-1">Length (ft)</p>
              <input type="number" value={line.L ?? ''} min={1} step={0.5} placeholder="e.g. 18"
                onChange={e => upd({ L: parseFloat(e.target.value) || 0 })} className={inp} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Sq Ft (auto)</p>
              <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 font-semibold">
                {line.sqft} sq ft
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <p className="text-xs text-gray-400 mb-1">Width (ft)</p>
              <input type="number" value={line.W ?? ''} min={0.5} step={0.5}
                onChange={e => upd({ W: parseFloat(e.target.value) || 0 })} className={inp} />
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Height (ft)</p>
              <input type="number" value={line.H ?? ''} min={0.5} step={0.5}
                onChange={e => upd({ H: parseFloat(e.target.value) || 0 })} className={inp} />
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-400 mb-1">Sq Ft (auto)</p>
              <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 font-semibold">
                {line.sqft} sq ft
              </div>
            </div>
          </>
        )}

        <div>
          <p className="text-xs text-gray-400 mb-1">Material</p>
          <select value={line.material} onChange={e => upd({ material: e.target.value as MaterialType })} className={sel}>
            {Object.entries(MATERIAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Complexity</p>
          <select value={line.complexity} onChange={e => upd({ complexity: e.target.value as ComplexityLevel })} className={sel}>
            {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Options */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Job includes:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'isPrinted',    label: 'Full Color Print' },
            { key: 'hasLamination', label: 'Lamination' },
            { key: 'hasDesign',    label: 'Custom Design' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => upd({ [key]: !line[key as keyof SqFtLine] } as any)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                line[key as keyof SqFtLine]
                  ? 'border-orange-400 bg-orange-50 text-orange-700 font-semibold'
                  : 'border-gray-200 text-gray-400 hover:border-orange-300'
              }`}>
              {line[key as keyof SqFtLine] ? '✓ ' : '+ '}{label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1">Description (shown on quote)</p>
        <input value={line.description}
          onChange={e => upd({ description: e.target.value })}
          placeholder="e.g. 18ft food truck, full color print, white base..."
          className={inp} />
      </div>
    </div>
  )
}

// ─── VEHICLE CARD ─────────────────────────────────────────────────────────────
function VehicleCard({ line, onChange, onRemove }: {
  line: VehicleLine
  onChange: (id: string, u: Partial<VehicleLine>) => void
  onRemove: (id: string) => void
}) {
  function upd(u: Partial<VehicleLine>) { onChange(line.id, u) }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-800">
            {VEHICLE_TYPE_LABELS[line.vehicleType]} — {WRAP_TYPE_LABELS[line.wrapType]}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{line.includesText}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-orange-600">{formatCurrency(line.subtotal)}</span>
          <button onClick={() => onRemove(line.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Vehicle Type</p>
          <select value={line.vehicleType} onChange={e => upd({ vehicleType: e.target.value })} className={sel}>
            {Object.entries(VEHICLE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Wrap Type</p>
          <select value={line.wrapType} onChange={e => upd({ wrapType: e.target.value as WrapType })} className={sel}>
            {Object.entries(WRAP_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Material</p>
          <select value={line.material} onChange={e => upd({ material: e.target.value as MaterialType })} className={sel}>
            {Object.entries(MATERIAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Complexity</p>
          <select value={line.complexity} onChange={e => upd({ complexity: e.target.value as ComplexityLevel })} className={sel}>
            {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Add-ons:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'colorChange',  label: 'Color Change Film' },
            { key: 'printedWrap',  label: 'Printed Wrap' },
            { key: 'chromeDelete', label: 'Chrome Delete' },
            { key: 'hasDesign',    label: 'Custom Design' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => upd({ [key]: !line[key as keyof VehicleLine] } as any)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                line[key as keyof VehicleLine]
                  ? 'border-orange-400 bg-orange-50 text-orange-700 font-semibold'
                  : 'border-gray-200 text-gray-400 hover:border-orange-300'
              }`}>
              {line[key as keyof VehicleLine] ? '✓ ' : '+ '}{label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-1">Year / Make / Model / Notes</p>
        <input value={line.notes} onChange={e => upd({ notes: e.target.value })}
          placeholder="e.g. 2022 Ford F-150, white base, customer provides design..."
          className={inp} />
      </div>
    </div>
  )
}

// ─── MAIN FORM ────────────────────────────────────────────────────────────────
function QuoteForm() {
  const router = useRouter()
  const params = useSearchParams()

  const clientIdRef   = useRef(params.get('clientId') || '')
  const notesRef      = useRef('')
  const [clients,      setClients]      = useState<any[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [mode,         setMode]         = useState<null | 'sqft' | 'vehicle'>(null)
  const [sqftLines,    setSqftLines]    = useState<SqFtLine[]>([])
  const [vehicleLines, setVehicleLines] = useState<VehicleLine[]>([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const totals   = calcTotals(sqftLines, vehicleLines)
  const hasLines = sqftLines.length + vehicleLines.length > 0

  const filteredClients = clients.filter(c =>
    !clientSearch ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase())
  )

  useEffect(() => {
    supabase.from('clients').select('id,name,company,phone').order('name').then(({ data }) => {
      if (!data) return
      setClients(data)
      const uid = params.get('clientId')
      if (uid) {
        const c = data.find((x: any) => x.id === uid)
        if (c) { clientIdRef.current = c.id; setClientSearch(c.name + (c.company ? ` (${c.company})` : '')) }
      }
    })
  }, [])

  // ── Sq Ft handlers ──
  function addSqFtLine(id: string, label: string, mode: 'L' | 'WH') {
    const line = buildSqFtLine(crypto.randomUUID(), label, mode)
    setSqftLines(p => [...p, line])
  }

  function updateSqFtLine(id: string, updates: Partial<SqFtLine>) {
    setSqftLines(p => p.map(l => l.id === id ? recalcSqFtLine({ ...l, ...updates }) : l))
  }

  function removeSqFtLine(id: string) { setSqftLines(p => p.filter(l => l.id !== id)) }

  // ── Vehicle handlers ──
  function addVehicleLine() {
    const base: VehicleLine = {
      id: crypto.randomUUID(), vehicleType: 'sedan', wrapType: 'full',
      material: 'gf', complexity: 'simple',
      colorChange: false, printedWrap: false, chromeDelete: false, hasDesign: false,
      subtotal: 0, notes: '', includesText: '',
    }
    setVehicleLines(p => [...p, recalcVehicleLine(base)])
  }

  function updateVehicleLine(id: string, updates: Partial<VehicleLine>) {
    setVehicleLines(p => p.map(l => l.id === id ? recalcVehicleLine({ ...l, ...updates }) : l))
  }

  function removeVehicleLine(id: string) { setVehicleLines(p => p.filter(l => l.id !== id)) }

  // ── Save ──
  async function saveQuote(status: 'draft' | 'sent') {
    const cid = clientIdRef.current
    if (!cid)        { setError('Select a client first'); return }
    if (!hasLines)   { setError('Add at least one service line'); return }
    setSaving(true); setError('')

    const qNum    = await generateQuoteNumber()
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()

    const items = [
      ...sqftLines.map(l => ({ type: 'sqft', ...l })),
      ...vehicleLines.map(l => ({ type: 'vehicle', ...l })),
    ]

    const { data, error: err } = await supabase.from('quotes').insert({
      quote_number: qNum, client_id: cid, status,
      items, subtotal: totals.subtotal,
      tax_rate: TAX_RATE, tax_amount: totals.tax,
      total: totals.total, deposit_amount: totals.deposit,
      balance: totals.balance,
      notes: notesRef.current || null,
      expires_at: expires, valid_days: 30,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/quotes/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/quotes')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">New Quote</h1>
          <p className="text-xs text-gray-400">Infinity Wrap Design</p>
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

        {/* LEFT */}
        <div className="col-span-1 space-y-4">

          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Client</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Search client..." value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); clientIdRef.current = '' }} />
            </div>
            {clientSearch && !clientIdRef.current && filteredClients.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
                {filteredClients.slice(0, 8).map((c: any) => (
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
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Job Notes</h2>
            <textarea defaultValue="" onChange={e => { notesRef.current = e.target.value }}
              rows={3} placeholder="Vehicle info, timeline, special instructions..."
              className={inp + ' resize-none text-xs'} />
          </div>

          {/* Totals */}
          {hasLines && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Summary</h2>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax (6.75%)</span><span>{formatCurrency(totals.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 pt-2 border-t text-base">
                <span>Total</span><span>{formatCurrency(totals.total)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold text-orange-600">
                <span>Deposit (50%)</span><span>{formatCurrency(totals.deposit)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-400">
                <span>Balance Due</span><span>{formatCurrency(totals.balance)}</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
          )}
        </div>

        {/* RIGHT */}
        <div className="col-span-2 space-y-4">

          {/* Mode selector */}
          {mode === null ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">What type of job?</h2>
              <p className="text-xs text-gray-400 mb-5">Choose the pricing engine for this quote</p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'vehicle', icon: <Car className="w-6 h-6 text-orange-500" />, title: 'Vehicle Wrap', sub: 'Cars, SUVs, Trucks, Vans', desc: 'Price by vehicle type + options' },
                  { key: 'sqft',    icon: <Ruler className="w-6 h-6 text-orange-500" />, title: 'By Square Feet', sub: 'Murals, Food Trucks, Signs', desc: 'Price by dimensions × $/sq ft' },
                ].map(({ key, icon, title, sub, desc }) => (
                  <button key={key} onClick={() => setMode(key as any)}
                    className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all group">
                    <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center">
                      {icon}
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-gray-800 text-sm">{title}</p>
                      <p className="text-xs text-gray-400 mt-1">{sub}</p>
                      <p className="text-xs text-gray-300 mt-1">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              {[
                { key: 'vehicle', icon: <Car className="w-4 h-4" />, label: 'Vehicle Quote' },
                { key: 'sqft',    icon: <Ruler className="w-4 h-4" />, label: 'Sq Ft Quote' },
              ].map(({ key, icon, label }) => (
                <button key={key} onClick={() => setMode(key as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    mode === key ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-400 hover:border-orange-300'
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>
          )}

          {/* Vehicle lines */}
          {mode === 'vehicle' && (
            <div className="space-y-3">
              {vehicleLines.map(l => (
                <VehicleCard key={l.id} line={l} onChange={updateVehicleLine} onRemove={removeVehicleLine} />
              ))}
              <button onClick={addVehicleLine}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-all font-medium">
                + Add Vehicle
              </button>
            </div>
          )}

          {/* Sq Ft lines */}
          {mode === 'sqft' && (
            <div className="space-y-3">
              {sqftLines.map(l => (
                <SqFtCard key={l.id} line={l} onChange={updateSqFtLine} onRemove={removeSqFtLine} />
              ))}
              <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Trucks & Trailers (by Length)</p>
                  <div className="flex flex-wrap gap-2">
                    {SQFT_SERVICES_L.map(s => (
                      <button key={s.id} onClick={() => addSqFtLine(s.id, s.label, 'L')}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
                        + {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Flat Surfaces (by Width × Height)</p>
                  <div className="flex flex-wrap gap-2">
                    {SQFT_SERVICES_WH.map(s => (
                      <button key={s.id} onClick={() => addSqFtLine(s.id, s.label, 'WH')}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
                        + {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bottom summary bar */}
          {hasLines && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-orange-800">
                  {sqftLines.length + vehicleLines.length} line{sqftLines.length + vehicleLines.length !== 1 ? 's' : ''} · {formatCurrency(totals.total)}
                </p>
                <p className="text-xs text-orange-600">Deposit: {formatCurrency(totals.deposit)} · Balance: {formatCurrency(totals.balance)}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => saveQuote('draft')} disabled={saving}
                  className="px-4 py-2 rounded-lg border border-orange-300 text-sm font-medium text-orange-700 hover:bg-orange-100 disabled:opacity-50">
                  Draft
                </button>
                <button onClick={() => saveQuote('sent')} disabled={saving}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Quote'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewQuotePage() { return <Suspense><QuoteForm /></Suspense> }
