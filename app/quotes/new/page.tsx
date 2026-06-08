'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TAX_RATE, DEPOSIT_RATE, formatCurrency, generateQuoteNumber } from '@/lib/quote-engine'
import { ArrowLeft, Save, Search, CheckCircle, ChevronRight, Ruler, Car } from 'lucide-react'

// ─── TYPES ────────────────────────────────────────────────────────────────────

type QuoteMode = null | 'sqft' | 'vehicle'

interface SqFtLine {
  id: string; label: string; description: string
  width: number; height: number; sqft: number
  pricePerSqft: number; material: string; complexity: string; subtotal: number
}

interface VehicleLine {
  id: string; vehicleType: string; wrapType: string
  material: string; colorChange: boolean; printedWrap: boolean
  chromeDelete: boolean; designIncluded: boolean; complexity: string
  basePrice: number; addons: number; subtotal: number; notes: string
}

// ─── PRICING TABLES ───────────────────────────────────────────────────────────

const SQFT_PRICE = 12.50 // default, editable per item

const VEHICLE_BASE_PRICES: Record<string, Record<string, number>> = {
  sedan:    { full: 2800, partial: 900,  decals: 350 },
  suv:      { full: 3500, partial: 1200, decals: 400 },
  truck:    { full: 3800, partial: 1300, decals: 450 },
  van:      { full: 4500, partial: 1500, decals: 500 },
  box_truck:{ full: 5500, partial: 2000, decals: 600 },
  trailer:  { full: 4800, partial: 1800, decals: 550 },
  food_truck:{ full: 5000, partial: 1900, decals: 580 },
}

const VEHICLE_LABELS: Record<string, string> = {
  sedan: 'Sedan / Coupe', suv: 'SUV / Crossover', truck: 'Truck (Crew/Regular)',
  van: 'Van / Sprinter', box_truck: 'Box Truck', trailer: 'Trailer', food_truck: 'Food Truck',
}

const WRAP_TYPES: Record<string, string> = {
  full: 'Full Wrap', partial: 'Partial Wrap', decals: 'Decals / Lettering',
}

const MATERIALS: Record<string, string> = {
  gf: 'General Formulations', avery: 'Avery Dennison', '3m': '3M Series', premium: 'Premium / Specialty',
}

const MATERIAL_MULT: Record<string, number> = { gf: 1.0, avery: 1.10, '3m': 1.20, premium: 1.35 }

const COMPLEXITY_MULT: Record<string, number> = { simple: 1.0, medium: 1.20, complex: 1.45 }
const COMPLEXITY_LABELS: Record<string, string> = {
  simple: 'Simple — flat, no obstacles',
  medium: 'Medium — curves, mild obstructions',
  complex: 'Complex — rivets, recesses, heavy cuts',
}

const SQFT_SERVICES = [
  { id: 'wall_mural',      label: 'Wall Mural' },
  { id: 'window_graphics', label: 'Window Graphics' },
  { id: 'storefront',      label: 'Storefront Graphics' },
  { id: 'banner',          label: 'Banner / Sign' },
  { id: 'floor_graphics',  label: 'Floor Graphics' },
  { id: 'perforated',      label: 'Perforated Vinyl' },
  { id: 'custom',          label: 'Custom Flat Surface' },
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function calcSqFtLine(line: SqFtLine): number {
  const sqft = line.width * line.height
  return Math.round(sqft * line.pricePerSqft * COMPLEXITY_MULT[line.complexity] * 100) / 100
}

function calcVehicleLine(line: VehicleLine): number {
  const base = VEHICLE_BASE_PRICES[line.vehicleType]?.[line.wrapType] ?? 0
  let addons = 0
  if (line.colorChange)    addons += 500
  if (line.printedWrap)    addons += 300
  if (line.chromeDelete)   addons += 300
  if (line.designIncluded) addons += 250
  const mat  = MATERIAL_MULT[line.material] ?? 1.0
  const comp = COMPLEXITY_MULT[line.complexity] ?? 1.0
  return Math.round(((base * mat * comp) + addons) * 100) / 100
}

function calcTotals(sqftLines: SqFtLine[], vehicleLines: VehicleLine[]) {
  const sub  = [...sqftLines.map(l => l.subtotal), ...vehicleLines.map(l => l.subtotal)]
    .reduce((a, b) => a + b, 0)
  const subtotal = Math.round(sub * 100) / 100
  const tax      = Math.round(subtotal * TAX_RATE * 100) / 100
  const total    = Math.round((subtotal + tax) * 100) / 100
  const deposit  = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  return { subtotal, tax, total, deposit, balance }
}

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
const sel = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"

// ─── SQFT LINE COMPONENT ──────────────────────────────────────────────────────

function SqFtLineCard({ line, onChange, onRemove }: {
  line: SqFtLine
  onChange: (id: string, updates: Partial<SqFtLine>) => void
  onRemove: (id: string) => void
}) {
  const sqft = Math.round(line.width * line.height * 100) / 100
  const sub  = Math.round(sqft * line.pricePerSqft * COMPLEXITY_MULT[line.complexity] * 100) / 100

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <input value={line.label} onChange={e => onChange(line.id, { label: e.target.value })}
          className="font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none focus:border-orange-400 text-sm w-48" />
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-orange-600">{formatCurrency(sub)}</span>
          <button onClick={() => onRemove(line.id)} className="text-xs text-red-400 hover:text-red-600">✕ Remove</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Width (ft)</p>
          <input type="number" value={line.width} min={0.5} step={0.5}
            onChange={e => onChange(line.id, { width: parseFloat(e.target.value) || 0 })} className={inp} />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Height (ft)</p>
          <input type="number" value={line.height} min={0.5} step={0.5}
            onChange={e => onChange(line.id, { height: parseFloat(e.target.value) || 0 })} className={inp} />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Sq Ft</p>
          <div className="w-full border border-gray-100 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 font-medium">
            {sqft} sq ft
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Price / Sq Ft</p>
          <input type="number" value={line.pricePerSqft} min={1} step={0.25}
            onChange={e => onChange(line.id, { pricePerSqft: parseFloat(e.target.value) || 12.50 })} className={inp} />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Material</p>
          <select value={line.material} onChange={e => onChange(line.id, { material: e.target.value })} className={sel}>
            {Object.entries(MATERIALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Complexity</p>
          <select value={line.complexity} onChange={e => onChange(line.id, { complexity: e.target.value })} className={sel}>
            {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-400 mb-1">Description / Notes</p>
        <input value={line.description} onChange={e => onChange(line.id, { description: e.target.value })}
          placeholder="Location, colors, special instructions..." className={inp} />
      </div>
    </div>
  )
}

// ─── VEHICLE LINE COMPONENT ───────────────────────────────────────────────────

function VehicleLineCard({ line, onChange, onRemove }: {
  line: VehicleLine
  onChange: (id: string, updates: Partial<VehicleLine>) => void
  onRemove: (id: string) => void
}) {
  const sub = calcVehicleLine(line)

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex justify-between items-center">
        <span className="font-semibold text-gray-800 text-sm">
          {VEHICLE_LABELS[line.vehicleType] || 'Vehicle'} — {WRAP_TYPES[line.wrapType] || 'Wrap'}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-orange-600">{formatCurrency(sub)}</span>
          <button onClick={() => onRemove(line.id)} className="text-xs text-red-400 hover:text-red-600">✕ Remove</button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">Vehicle Type</p>
          <select value={line.vehicleType} onChange={e => onChange(line.id, { vehicleType: e.target.value })} className={sel}>
            {Object.entries(VEHICLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Wrap Type</p>
          <select value={line.wrapType} onChange={e => onChange(line.id, { wrapType: e.target.value })} className={sel}>
            {Object.entries(WRAP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Material</p>
          <select value={line.material} onChange={e => onChange(line.id, { material: e.target.value })} className={sel}>
            {Object.entries(MATERIALS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">Complexity</p>
          <select value={line.complexity} onChange={e => onChange(line.id, { complexity: e.target.value })} className={sel}>
            {Object.entries(COMPLEXITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Add-ons */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Add-ons</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'colorChange',    label: 'Color Change Film +$500' },
            { key: 'printedWrap',    label: 'Printed Wrap +$300' },
            { key: 'chromeDelete',   label: 'Chrome Delete +$300' },
            { key: 'designIncluded', label: 'Design Fee +$250' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => onChange(line.id, { [key]: !line[key as keyof VehicleLine] } as any)}
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
        <input value={line.notes} onChange={e => onChange(line.id, { notes: e.target.value })}
          placeholder="e.g. 2022 Ford F-150 white, customer provides design..." className={inp} />
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
  const [mode,         setMode]         = useState<QuoteMode>(null)
  const [sqftLines,    setSqftLines]    = useState<SqFtLine[]>([])
  const [vehicleLines, setVehicleLines] = useState<VehicleLine[]>([])
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const totals = calcTotals(sqftLines, vehicleLines)

  const filteredClients = clients.filter(c =>
    !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase())
  )

  useEffect(() => {
    supabase.from('clients').select('id,name,company,phone').order('name').then(({ data }) => {
      if (!data) return
      setClients(data)
      const urlClientId = params.get('clientId')
      if (urlClientId) {
        const c = data.find((c: any) => c.id === urlClientId)
        if (c) { clientIdRef.current = c.id; setClientSearch(c.name + (c.company ? ` (${c.company})` : '')) }
      }
    })
  }, [])

  // ── Sq Ft handlers ──
  function addSqFtLine(serviceId: string, label: string) {
    setSqftLines(p => [...p, {
      id: crypto.randomUUID(), label, description: '',
      width: 0, height: 0, sqft: 0,
      pricePerSqft: SQFT_PRICE, material: 'gf', complexity: 'simple', subtotal: 0
    }])
  }

  function updateSqFtLine(id: string, updates: Partial<SqFtLine>) {
    setSqftLines(p => p.map(l => {
      if (l.id !== id) return l
      const u = { ...l, ...updates }
      u.sqft    = Math.round(u.width * u.height * 100) / 100
      u.subtotal = Math.round(u.sqft * u.pricePerSqft * COMPLEXITY_MULT[u.complexity] * 100) / 100
      return u
    }))
  }

  function removeSqFtLine(id: string) { setSqftLines(p => p.filter(l => l.id !== id)) }

  // ── Vehicle handlers ──
  function addVehicleLine() {
    setVehicleLines(p => [...p, {
      id: crypto.randomUUID(), vehicleType: 'sedan', wrapType: 'full',
      material: 'gf', colorChange: false, printedWrap: false,
      chromeDelete: false, designIncluded: false, complexity: 'simple',
      basePrice: 2800, addons: 0, subtotal: 2800, notes: ''
    }])
  }

  function updateVehicleLine(id: string, updates: Partial<VehicleLine>) {
    setVehicleLines(p => p.map(l => {
      if (l.id !== id) return l
      const u = { ...l, ...updates }
      u.subtotal = calcVehicleLine(u)
      return u
    }))
  }

  function removeVehicleLine(id: string) { setVehicleLines(p => p.filter(l => l.id !== id)) }

  // ── Save ──
  async function saveQuote(status: 'draft' | 'sent') {
    const cid = clientIdRef.current
    if (!cid) { setError('Select a client first'); return }
    const totalLines = sqftLines.length + vehicleLines.length
    if (totalLines === 0) { setError('Add at least one service line'); return }
    setSaving(true); setError('')

    const qNum    = generateQuoteNumber()
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()

    // Build unified items array for storage
    const items = [
      ...sqftLines.map(l => ({
        type: 'sqft', id: l.id, label: l.label, description: l.description,
        width: l.width, height: l.height, sqft: l.sqft,
        pricePerSqft: l.pricePerSqft, material: l.material,
        complexity: l.complexity, subtotal: l.subtotal,
      })),
      ...vehicleLines.map(l => ({
        type: 'vehicle', id: l.id, vehicleType: l.vehicleType, wrapType: l.wrapType,
        material: l.material, complexity: l.complexity,
        colorChange: l.colorChange, printedWrap: l.printedWrap,
        chromeDelete: l.chromeDelete, designIncluded: l.designIncluded,
        subtotal: l.subtotal, notes: l.notes,
      })),
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

  const hasLines = sqftLines.length + vehicleLines.length > 0

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

        {/* LEFT — Client + Totals */}
        <div className="col-span-1 space-y-4">

          {/* Client */}
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
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Summary</h2>
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

        {/* RIGHT — Quote Builder */}
        <div className="col-span-2 space-y-4">

          {/* Mode Selector */}
          {mode === null && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">What type of job is this?</h2>
              <p className="text-xs text-gray-400 mb-5">Select the pricing engine for this quote</p>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setMode('vehicle')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all group">
                  <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center transition-all">
                    <Car className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-800 text-sm">Vehicle Wrap</p>
                    <p className="text-xs text-gray-400 mt-1">Cars, SUVs, Trucks, Vans</p>
                    <p className="text-xs text-gray-300 mt-1">Price by vehicle type + options</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400" />
                </button>
                <button onClick={() => setMode('sqft')}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-orange-400 hover:bg-orange-50 transition-all group">
                  <div className="w-12 h-12 rounded-full bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center transition-all">
                    <Ruler className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-800 text-sm">By Square Feet</p>
                    <p className="text-xs text-gray-400 mt-1">Murals, Windows, Signs, Food Trucks</p>
                    <p className="text-xs text-gray-300 mt-1">Price by width × height × $/sq ft</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400" />
                </button>
              </div>
            </div>
          )}

          {/* Both buttons always visible once mode is selected */}
          {mode !== null && (
            <div className="flex gap-3">
              <button onClick={() => setMode('vehicle')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  mode === 'vehicle' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-400 hover:border-orange-300'
                }`}>
                <Car className="w-4 h-4" /> Vehicle Quote
              </button>
              <button onClick={() => setMode('sqft')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                  mode === 'sqft' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-400 hover:border-orange-300'
                }`}>
                <Ruler className="w-4 h-4" /> Sq Ft Quote
              </button>
            </div>
          )}

          {/* VEHICLE MODE */}
          {mode === 'vehicle' && (
            <div className="space-y-3">
              {vehicleLines.map(line => (
                <VehicleLineCard key={line.id} line={line} onChange={updateVehicleLine} onRemove={removeVehicleLine} />
              ))}
              <button onClick={addVehicleLine}
                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-all font-medium">
                + Add Vehicle
              </button>
            </div>
          )}

          {/* SQFT MODE */}
          {mode === 'sqft' && (
            <div className="space-y-3">
              {sqftLines.map(line => (
                <SqFtLineCard key={line.id} line={line} onChange={updateSqFtLine} onRemove={removeSqFtLine} />
              ))}
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-3">Add a surface:</p>
                <div className="flex flex-wrap gap-2">
                  {SQFT_SERVICES.map(svc => (
                    <button key={svc.id} onClick={() => addSqFtLine(svc.id, svc.label)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-all">
                      + {svc.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mixed mode — show both sections if lines exist */}
          {hasLines && mode !== null && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-bold text-orange-800">
                  {sqftLines.length + vehicleLines.length} line{sqftLines.length + vehicleLines.length !== 1 ? 's' : ''} · Total: {formatCurrency(totals.total)}
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
