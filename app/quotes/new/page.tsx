'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TAX_RATE, formatCurrency, generateQuoteNumber } from '@/lib/quote-engine'
import { ArrowLeft, Save, Plus, Send, Tag, Trash2 } from 'lucide-react'

interface ClientRow { id: string; name: string; phone?: string | null; company?: string | null }
interface LineItem { id: string; description: string; qty: number; unitPrice: number }

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"

function newLine(): LineItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    qty: 1,
    unitPrice: 0,
  }
}

// ── CALCULADORA 1: Costo Proveedor × Margen ──
const VINYL_PRICES = {
  'cast-30-250': { name: 'Vinilo Cast impreso + laminado (30-250 ft²)', price: 8.50 },
  'cast-250plus': { name: 'Vinilo Cast impreso + laminado (>250 ft²)', price: 7.50 },
  'reflective': { name: 'Vinilo reflectivo impreso', price: 22.00 },
  'sticker-printed': { name: 'Sticker vinilo impreso + laminado', price: 10.00 },
  'sticker-cast': { name: 'Sticker vinilo fundido + laminado', price: 15.00 },
  'sticker-reflective': { name: 'Sticker vinilo reflectivo', price: 25.00 },
}

// ── CALCULADORA 2: Full Wrap Trailer/Truck ──
const calcFullWrapSqft = (length: number): number => {
  return (length * 8) * 2 + (8 * 8) * 2 // (L × 8) × 2 + (8 × 8) × 2
}

const calcFullWrapPrice = (sqft: number, jobType: 'wrap' | 'sticker', vehicleType: 'truck' | 'trailer'): number => {
  const baseRate = jobType === 'wrap' ? 8.50 : 13.50
  const extraRate = vehicleType === 'truck' ? 4 : 2.93
  return (sqft * baseRate) + (sqft * extraRate)
}

export default function NewQuotePage() {
  const router = useRouter()

  // ── Clients ──
  const [clients, setClients] = useState<ClientRow[]>([])
  const [clientId, setClientId] = useState<string>('')
  const [clientSearch, setClientSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')

  // ── Calculator 1: Costo Proveedor ──
  const [calcVinyl, setCalcVinyl] = useState<string>('cast-30-250')
  const [calcSqft, setCalcSqft] = useState<number>(0)
  const [calcMargin, setCalcMargin] = useState<number>(25)

  // ── Calculator 2: Full Wrap ──
  const [fullWrapLength, setFullWrapLength] = useState<number>(0)
  const [fullWrapJob, setFullWrapJob] = useState<'wrap' | 'sticker'>('wrap')
  const [fullWrapVehicle, setFullWrapVehicle] = useState<'truck' | 'trailer'>('truck')

  // ── Lines ──
  const [lines, setLines] = useState<LineItem[]>([newLine()])
  const [notes, setNotes] = useState('')

  // ── Discount ──
  const [discType, setDiscType] = useState<'none' | 'percent' | 'amount'>('none')
  const [discValue, setDiscValue] = useState<number>(0)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    const { data } = await supabase.from('clients').select('id,name,phone,company').order('name')
    setClients(data || [])
  }

  const filteredClients = useMemo(() => {
    const s = clientSearch.toLowerCase()
    return clients.filter(c =>
      c.name.toLowerCase().includes(s) ||
      (c.company || '').toLowerCase().includes(s) ||
      (c.phone || '').includes(s)
    )
  }, [clients, clientSearch])

  const selectedClient = clients.find(c => c.id === clientId)

  async function createClient() {
    if (!newClientName.trim()) return
    const { data, error: err } = await supabase.from('clients')
      .insert({ name: newClientName.trim(), phone: newClientPhone.trim() || null })
      .select().single()
    if (err) { setError(err.message); return }
    setClients(p => [...p, data].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(data.id)
    setCreatingClient(false)
    setNewClientName(''); setNewClientPhone('')
    setError('')
  }

  function updLine(id: string, u: Partial<LineItem>) {
    setLines(p => p.map(l => l.id === id ? { ...l, ...u } : l))
  }
  function removeLine(id: string) { setLines(p => p.filter(l => l.id !== id)) }

  // ── Calculations ──
  const subtotal = lines.reduce((sum, l) => sum + (l.qty * l.unitPrice), 0)
  let discountAmount = 0
  if (discType === 'percent') {
    discountAmount = subtotal * (discValue / 100)
  } else if (discType === 'amount') {
    discountAmount = discValue
  }
  const subtotalAfterDisc = subtotal - discountAmount
  const tax = subtotalAfterDisc * TAX_RATE
  const total = subtotalAfterDisc + tax
  const deposit = total * 0.5
  const balance = total - deposit

  // ── Calculator 1 Results ──
  const vinylInfo = VINYL_PRICES[calcVinyl as keyof typeof VINYL_PRICES]
  const calcCost = calcSqft * vinylInfo.price
  const calcPrice = calcCost * (1 + calcMargin / 100)

  // ── Calculator 2 Results ──
  const fullWrapSqft = calcFullWrapSqft(fullWrapLength)
  const fullWrapPrice = fullWrapLength > 0 ? calcFullWrapPrice(fullWrapSqft, fullWrapJob, fullWrapVehicle) : 0

  // ── Save ──
  async function saveQuote(status: 'draft' | 'sent') {
    if (!clientId) { setError('Selecciona o crea un cliente primero'); return }
    if (!lines.some(l => l.description.trim() && l.unitPrice > 0)) {
      setError('Agrega al menos una línea con descripción y precio')
      return
    }
    setSaving(true); setError('')

    const qNum = await generateQuoteNumber()
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()

    const items: any[] = lines
      .filter(l => l.description.trim() && l.unitPrice > 0)
      .map(l => ({
        type: 'line',
        label: l.description,
        description: '',
        qty: l.qty,
        unitPrice: l.unitPrice,
        subtotal: l.qty * l.unitPrice,
      }))

    if (discountAmount > 0) {
      items.push({
        type: 'discount',
        label: discType === 'percent' ? `Descuento (${discValue}%)` : 'Descuento',
        discountType: discType,
        discountValue: discValue,
        qty: 1,
        unitPrice: -discountAmount,
        subtotal: -discountAmount,
      })
    }

    const { data, error: err } = await supabase.from('quotes').insert({
      quote_number: qNum,
      client_id: clientId,
      status,
      items,
      subtotal,
      tax_rate: TAX_RATE,
      tax_amount: tax,
      total,
      deposit_amount: deposit,
      balance,
      notes: notes || null,
      expires_at: expires,
      valid_days: 30,
    }).select().single()

    if (err) { setError(err.message); setSaving(false); return }
    router.push(`/quotes/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={() => router.push('/quotes')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex-1">Nueva Quote</h1>
        <button onClick={() => saveQuote('draft')} disabled={saving}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 flex items-center gap-2">
          <Save size={16} /> Guardar Draft
        </button>
        <button onClick={() => saveQuote('sent')} disabled={saving}
          className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2">
          <Send size={16} /> Guardar y Enviar
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        {/* ── Cliente ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="font-bold text-gray-800">Cliente</p>

          {selectedClient ? (
            <div className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
              <div>
                <p className="font-semibold text-gray-800">{selectedClient.name}</p>
                {selectedClient.phone && <p className="text-xs text-gray-500">{selectedClient.phone}</p>}
              </div>
              <button onClick={() => setClientId('')} className="text-xs text-orange-600 hover:underline">Cambiar</button>
            </div>
          ) : creatingClient ? (
            <div className="space-y-2">
              <input className={inp} placeholder="Nombre del cliente *" value={newClientName}
                onChange={e => setNewClientName(e.target.value)} autoFocus />
              <input className={inp} placeholder="Teléfono (opcional)" value={newClientPhone}
                onChange={e => setNewClientPhone(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createClient() }} />
              <div className="flex gap-2">
                <button onClick={createClient}
                  className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600">
                  Crear cliente
                </button>
                <button onClick={() => setCreatingClient(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <input className={inp} placeholder="Buscar cliente por nombre o teléfono…"
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)} />
              {showDropdown && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {filteredClients.map(c => (
                    <button key={c.id}
                      onClick={() => { setClientId(c.id); setShowDropdown(false); setClientSearch('') }}
                      className="w-full text-left px-4 py-2.5 hover:bg-orange-50 text-sm">
                      <span className="font-medium text-gray-800">{c.name}</span>
                      {c.phone && <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>}
                    </button>
                  ))}
                  <button onClick={() => { setCreatingClient(true); setShowDropdown(false) }}
                    className="w-full text-left px-4 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50 border-t border-gray-100">
                    + Crear cliente nuevo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CALCULADORA 1: Costo Proveedor × Margen ── */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-5 space-y-4">
          <p className="font-bold text-blue-900">📊 Costo Proveedor × Margen (REFERENCIA)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">MATERIAL</p>
              <select value={calcVinyl} onChange={e => setCalcVinyl(e.target.value)} className={inp}>
                {Object.entries(VINYL_PRICES).map(([k, v]) => (
                  <option key={k} value={k}>{v.name} (${v.price})</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">SQ FT</p>
              <input type="number" min={0} step={10} value={calcSqft || ''} onChange={e => setCalcSqft(parseFloat(e.target.value) || 0)} className={inp} />
            </div>
            <div>
              <p className="text-xs text-blue-600 font-bold mb-1">MARGEN (%)</p>
              <input type="number" min={0} max={200} step={5} value={calcMargin || ''} onChange={e => setCalcMargin(parseFloat(e.target.value) || 0)} className={inp} />
            </div>
          </div>
          {calcSqft > 0 && (
            <div className="bg-white rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-600">Costo proveedor:</span><span className="font-bold">{formatCurrency(calcCost)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Margen ({calcMargin}%):</span><span className="font-bold text-green-600">+{formatCurrency(calcPrice - calcCost)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-bold">Precio final:</span><span className="text-lg font-bold text-blue-600">{formatCurrency(calcPrice)}</span></div>
            </div>
          )}
        </div>

        {/* ── CALCULADORA 2: Full Wrap Trailer/Truck ── */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-xl p-5 space-y-4">
          <p className="font-bold text-green-900">🚚 Full Wrap Trailer / Truck (REFERENCIA)</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-green-600 font-bold mb-1">LARGO (ft)</p>
              <input type="number" min={0} step={1} value={fullWrapLength || ''} onChange={e => setFullWrapLength(parseFloat(e.target.value) || 0)} className={inp} />
            </div>
            <div>
              <p className="text-xs text-green-600 font-bold mb-1">TIPO DE TRABAJO</p>
              <select value={fullWrapJob} onChange={e => setFullWrapJob(e.target.value as 'wrap' | 'sticker')} className={inp}>
                <option value="wrap">Full Wrap</option>
                <option value="sticker">Sticker/Lettering</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-green-600 font-bold mb-1">TIPO DE VEHÍCULO</p>
              <select value={fullWrapVehicle} onChange={e => setFullWrapVehicle(e.target.value as 'truck' | 'trailer')} className={inp}>
                <option value="truck">Truck</option>
                <option value="trailer">Trailer</option>
              </select>
            </div>
          </div>
          {fullWrapLength > 0 && (
            <div className="bg-white rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-600">Sq Ft:</span><span className="font-bold">{fullWrapSqft}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-bold">Precio estimado:</span><span className="text-lg font-bold text-green-600">{formatCurrency(fullWrapPrice)}</span></div>
            </div>
          )}
        </div>

        {/* ── Líneas de Detalle ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-bold text-gray-800 mb-4">Líneas de Detalle</p>
          <div className="space-y-3">
            {lines.map((l, idx) => (
              <div key={l.id} className="flex gap-3 items-end">
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-1">Descripción</p>
                  <input
                    className={inp}
                    placeholder="Ej: Primer pago (50%)"
                    value={l.description}
                    onChange={e => updLine(l.id, { description: e.target.value })}
                  />
                </div>
                <div className="w-20">
                  <p className="text-xs text-gray-400 mb-1">Cantidad</p>
                  <input
                    type="number"
                    min={1}
                    className={inp}
                    value={l.qty || 1}
                    onChange={e => updLine(l.id, { qty: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="w-32">
                  <p className="text-xs text-gray-400 mb-1">Precio Unitario</p>
                  <input
                    type="number"
                    min={0}
                    step={10}
                    className={inp}
                    value={l.unitPrice || ''}
                    placeholder="$"
                    onChange={e => updLine(l.id, { unitPrice: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="w-24 text-right">
                  <p className="text-xs text-gray-400 mb-1">Subtotal</p>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(l.qty * l.unitPrice)}</p>
                </div>
                {lines.length > 1 && (
                  <button
                    onClick={() => removeLine(l.id)}
                    className="text-red-400 hover:text-red-600 pb-1"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => setLines(p => [...p, newLine()])}
            className="mt-4 w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:border-orange-400 hover:text-orange-600 flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Agregar línea
          </button>
        </div>

        {/* ── Descuento ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <p className="font-bold text-gray-800 flex items-center gap-2"><Tag size={16} className="text-orange-500" /> Descuento</p>
          <div className="grid grid-cols-3 gap-2">
            {([['none', 'Sin descuento'], ['percent', 'Porcentaje %'], ['amount', 'Monto $']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setDiscType(t)}
                className={`py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                  discType === t ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}>
                {label}
              </button>
            ))}
          </div>
          {discType !== 'none' && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <p className="text-xs text-gray-400 mb-1">{discType === 'percent' ? 'Porcentaje (%)' : 'Monto ($)'}</p>
                <input type="number" min={0} step={discType === 'percent' ? 1 : 25}
                  max={discType === 'percent' ? 100 : undefined} className={inp}
                  value={discValue || ''} placeholder={discType === 'percent' ? 'ej. 10' : 'ej. 200'}
                  onChange={e => setDiscValue(parseFloat(e.target.value) || 0)} />
              </div>
              {discountAmount > 0 && (
                <p className="text-sm text-green-600 font-semibold pb-2">− {formatCurrency(discountAmount)}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Notas ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-bold text-gray-800 mb-2">Notas de la quote</p>
          <textarea className={inp + ' min-h-20'} placeholder="Notas para el cliente (opcional)…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* ── Totales ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm text-green-600 font-semibold">
              <span>Descuento{discType === 'percent' ? ` (${discValue}%)` : ''}</span>
              <span>− {formatCurrency(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax NC (6.75%)</span><span>{formatCurrency(tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-100 pt-2">
            <span>Total</span><span>{formatCurrency(total)}</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center mt-2">
            <div className="text-sm">
              <p className="font-semibold text-gray-800">Depósito 50%: {formatCurrency(deposit)}</p>
              <p className="text-xs text-gray-500">Balance al terminar: {formatCurrency(balance)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
