'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TAX_RATE, formatCurrency, generateQuoteNumber, calcQuoteLine, calcTotals,
  VEHICLE_LABELS, JOB_LABELS, FIXED_HEIGHT,
  type SimpleLine, type VehicleKind, type JobKind,
} from '@/lib/quote-engine'
import { ArrowLeft, Save, Plus, Send } from 'lucide-react'

interface ClientRow { id: string; name: string; phone?: string | null; company?: string | null }

const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"

function newLine(): SimpleLine {
  const base: SimpleLine = {
    id: crypto.randomUUID(), vehicle: 'truck', job: 'wrap', L: 0,
    description: '', sqft: 0, subtotal: 0,
  }
  return recalc(base)
}

function recalc(l: SimpleLine): SimpleLine {
  const { sqft, subtotal } = calcQuoteLine(l.vehicle, l.job, l.L || 0)
  return { ...l, sqft, subtotal }
}

export default function NewQuotePage() {
  const router = useRouter()

  // ── Clients ──
  const [clients, setClients]       = useState<ClientRow[]>([])
  const [clientId, setClientId]     = useState<string>('')
  const [clientSearch, setClientSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientName, setNewClientName]   = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')

  // ── Lines ──
  const [lines, setLines] = useState<SimpleLine[]>([newLine()])
  const [notes, setNotes] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

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

  function updLine(id: string, u: Partial<SimpleLine>) {
    setLines(p => p.map(l => l.id === id ? recalc({ ...l, ...u }) : l))
  }
  function removeLine(id: string) { setLines(p => p.filter(l => l.id !== id)) }

  const validLines = lines.filter(l => l.L > 0)
  const totals = calcTotals(validLines)

  // ── Save ──
  async function saveQuote(status: 'draft' | 'sent') {
    if (!clientId)          { setError('Selecciona o crea un cliente primero'); return }
    if (!validLines.length) { setError('Agrega al menos una línea con el largo del vehículo'); return }
    setSaving(true); setError('')

    const qNum    = await generateQuoteNumber()
    const expires = new Date(Date.now() + 30 * 86400000).toISOString()

    const items = validLines.map(l => ({
      type: 'simple',
      label: `${JOB_LABELS[l.job]} — ${VEHICLE_LABELS[l.vehicle]} (${l.L} ft)`,
      description: l.description || '',
      vehicle: l.vehicle, job: l.job, L: l.L, sqft: l.sqft,
      qty: 1, unitPrice: l.subtotal, subtotal: l.subtotal,
    }))

    const { data, error: err } = await supabase.from('quotes').insert({
      quote_number: qNum, client_id: clientId, status,
      items, subtotal: totals.subtotal,
      tax_rate: TAX_RATE, tax_amount: totals.tax,
      total: totals.total, deposit_amount: totals.deposit,
      balance: totals.balance,
      notes: notes || null,
      expires_at: expires, valid_days: 30,
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

      <div className="max-w-3xl mx-auto p-6 space-y-6">
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

        {/* ── Líneas ── */}
        {lines.map((l, idx) => (
          <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-start">
              <p className="font-bold text-gray-800">Servicio {idx + 1}</p>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold text-orange-600">{formatCurrency(l.subtotal)}</span>
                {lines.length > 1 && (
                  <button onClick={() => removeLine(l.id)} className="text-xs text-red-400 hover:text-red-600">✕</button>
                )}
              </div>
            </div>

            {/* Vehículo */}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(VEHICLE_LABELS) as VehicleKind[]).map(v => (
                <button key={v} onClick={() => updLine(l.id, { vehicle: v })}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    l.vehicle === v ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {v === 'truck' ? '🚚 ' : '🚛 '}{VEHICLE_LABELS[v]}
                </button>
              ))}
            </div>

            {/* Tipo de trabajo */}
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(JOB_LABELS) as JobKind[]).map(j => (
                <button key={j} onClick={() => updLine(l.id, { job: j })}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                    l.job === j ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  {JOB_LABELS[j]}
                </button>
              ))}
            </div>

            {/* Largo */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <p className="text-xs text-gray-400 mb-1">Largo del vehículo (ft)</p>
                <input type="number" min={0} step={0.5} className={inp}
                  value={l.L || ''} placeholder="ej. 20"
                  onChange={e => updLine(l.id, { L: parseFloat(e.target.value) || 0 })} />
              </div>
              <div className="text-sm text-gray-500 pb-2">
                {l.L > 0 && <>= <span className="font-semibold text-gray-700">{l.sqft} sq ft</span> <span className="text-xs text-gray-400">(alto fijo {FIXED_HEIGHT} ft)</span></>}
              </div>
            </div>

            {/* Descripción */}
            <input className={inp} placeholder="Descripción / notas del vehículo (opcional)"
              value={l.description}
              onChange={e => updLine(l.id, { description: e.target.value })} />
          </div>
        ))}

        <button onClick={() => setLines(p => [...p, newLine()])}
          className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-sm font-semibold text-gray-500 hover:border-orange-400 hover:text-orange-600 flex items-center justify-center gap-2">
          <Plus size={16} /> Agregar otro vehículo
        </button>

        {/* ── Notas ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="font-bold text-gray-800 mb-2">Notas de la quote</p>
          <textarea className={inp + ' min-h-20'} placeholder="Notas para el cliente (opcional)…"
            value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        {/* ── Totales ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Tax NC (6.75%)</span><span>{formatCurrency(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-100 pt-2">
            <span>Total</span><span>{formatCurrency(totals.total)}</span>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex justify-between items-center mt-2">
            <div className="text-sm">
              <p className="font-semibold text-gray-800">Depósito 50%: {formatCurrency(totals.deposit)}</p>
              <p className="text-xs text-gray-500">Balance al terminar: {formatCurrency(totals.balance)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
