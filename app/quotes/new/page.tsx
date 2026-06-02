'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  calcVehicleSqFt, calcVehicleSubtotal, calcFlatSurface, calcTotals,
  loadAllPricingRules, generateQuoteNumber, formatCurrency, formatDate,
  VEHICLE_SERVICES, FLAT_SERVICES, FEE_SERVICES, WH_SERVICES,
  WARRANTY_TEXT, TERMS_TEXT, TAX_RATE, DEPOSIT_RATE,
  COMPLEXITY_MULTIPLIERS, COMPLEXITY_LABELS,
  MATERIAL_MULTIPLIERS, MATERIAL_LABELS,
  getInputMode,
  type QuoteLineItem, type PricingRule, type ComplexityLevel, type MaterialType
} from '@/lib/quote-engine'
import { Plus, Trash2, Save, ArrowLeft, AlertCircle, CheckCircle, Calculator, UserPlus } from 'lucide-react'

const ic = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
const lb = "text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block"

export default function NewQuotePage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [rules, setRules] = useState<PricingRule[]>([])
  const [loading, setLoading] = useState(true)

  // Quote header
  const [clientId, setClientId] = useState('')
  const [quoteNotes, setQuoteNotes] = useState('')
  const [items, setItems] = useState<QuoteLineItem[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Lead → Client conversion
  const [showLeadImport, setShowLeadImport] = useState(false)
  const [selectedLead, setSelectedLead] = useState('')
  const [convertingLead, setConvertingLead] = useState(false)

  // Current item form
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null)
  const [L, setL] = useState<number | ''>('')
  const [W, setW] = useState<number | ''>('')
  const [H, setH] = useState<number | ''>('')
  const [sqftManual, setSqftManual] = useState<number | ''>('')
  const [complexity, setComplexity] = useState<ComplexityLevel>('simple')
  const [material, setMaterial] = useState<MaterialType>('gf')
  const [itemDesc, setItemDesc] = useState('')
  const [manualPrice, setManualPrice] = useState<number | ''>('')
  const [itemNotes, setItemNotes] = useState('')

  const prevRuleRef = useRef<string>('')

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('leads').select('*').in('status', ['new','contacted','quoted','negotiating']).order('name'),
      loadAllPricingRules()
    ]).then(([clientRes, leadRes, pricingRules]) => {
      if (clientRes.data) setClients(clientRes.data)
      if (leadRes.data) setLeads(leadRes.data)
      setRules(pricingRules as PricingRule[])
      if (pricingRules.length > 0) setSelectedRule(pricingRules[0] as PricingRule)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!selectedRule) return
    if (prevRuleRef.current !== selectedRule.service_type) {
      prevRuleRef.current = selectedRule.service_type
      setL(''); setW(''); setH(''); setSqftManual(''); setManualPrice('')
      setItemDesc(selectedRule.label)
    }
  }, [selectedRule])

  const inputMode = selectedRule ? getInputMode(selectedRule.service_type) : 'sqft'
  const isVehicle = inputMode === 'L'
  const isWH = inputMode === 'WH'
  const isFee = inputMode === 'fee'
  const isFlat = FLAT_SERVICES.includes(selectedRule?.service_type || '') && !isWH

  // Computed sqft
  const computedSqft = (() => {
    if (isVehicle && L && selectedRule) {
      return calcVehicleSqFt(Number(L), selectedRule.sqft_multiplier_side, selectedRule.sqft_multiplier_top)
    }
    if (isWH && W && H) return Math.round(Number(W) * Number(H) * 100) / 100
    if (!isVehicle && !isWH && sqftManual) return Number(sqftManual)
    return 0
  })()

  // Base price before multipliers
  const basePrice = (() => {
    if (!selectedRule) return 0
    if (manualPrice !== '') return Number(manualPrice)
    if (isFee) return selectedRule.base_price || 0
    if (isVehicle && L && selectedRule.price_per_sqft && selectedRule.extra_rate != null) {
      return calcVehicleSubtotal(computedSqft, selectedRule.price_per_sqft, selectedRule.extra_rate)
    }
    if ((isWH || isFlat) && computedSqft > 0 && selectedRule.price_per_sqft) {
      return calcFlatSurface(computedSqft, selectedRule.price_per_sqft)
    }
    return 0
  })()

  // Final price with multipliers
  const cMult = COMPLEXITY_MULTIPLIERS[complexity]
  const mMult = MATERIAL_MULTIPLIERS[material]
  const preview = manualPrice !== ''
    ? Number(manualPrice)
    : isFee
      ? basePrice
      : Math.round(basePrice * cMult * mMult * 100) / 100

  // Lead → Client conversion
  async function convertLeadToClient() {
    if (!selectedLead) return
    setConvertingLead(true)
    const lead = leads.find(l => l.id === selectedLead)
    if (!lead) { setConvertingLead(false); return }
    // Create client from lead
    const { data: newClient, error: e } = await supabase.from('clients').insert({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      notes: `Converted from lead. Interest: ${lead.service_interest || 'N/A'}. Source: ${lead.source || 'N/A'}.`
    }).select().single()
    if (e || !newClient) { setError('Error converting lead: ' + e?.message); setConvertingLead(false); return }
    // Mark lead as won
    await supabase.from('leads').update({ status: 'won' }).eq('id', selectedLead)
    // Update local state
    setClients(prev => [...prev, newClient].sort((a,b) => a.name.localeCompare(b.name)))
    setLeads(prev => prev.filter(l => l.id !== selectedLead))
    setClientId(newClient.id)
    setShowLeadImport(false)
    setSelectedLead('')
    setConvertingLead(false)
    setSuccess(`✓ ${lead.name} converted to client and selected`)
    setTimeout(() => setSuccess(''), 4000)
  }

  function addItem() {
    setError('')
    if (!selectedRule) return
    if (isVehicle && !L) { setError('Enter vehicle length (L) in feet'); return }
    if (isWH && (!W || !H)) { setError('Enter width and height'); return }
    if (isFlat && !sqftManual) { setError('Enter square footage'); return }
    if (preview <= 0 && !isFee) { setError('Could not calculate price — enter a manual price or check dimensions'); return }

    const finalSqft = computedSqft

    const newItem: QuoteLineItem = {
      id: crypto.randomUUID(),
      service_type: selectedRule.service_type,
      label: selectedRule.label,
      description: itemDesc || selectedRule.label,
      L: isVehicle ? Number(L) : undefined,
      W: isWH ? Number(W) : undefined,
      H: isWH ? Number(H) : undefined,
      sqft: finalSqft,
      price_per_sqft: selectedRule.price_per_sqft || 0,
      extra_rate: selectedRule.extra_rate || undefined,
      material,
      complexity,
      material_multiplier: mMult,
      complexity_multiplier: cMult,
      base_price: basePrice,
      subtotal: manualPrice !== '' ? Number(manualPrice) : preview,
      material_rate: selectedRule.material_rate || undefined,
      labor_rate: selectedRule.labor_rate || undefined,
      notes: itemNotes || undefined,
    }

    setItems(prev => [...prev, newItem])
    setL(''); setW(''); setH(''); setSqftManual('')
    setItemDesc(''); setManualPrice(''); setItemNotes('')
    setComplexity('simple'); setMaterial('gf')
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
    if (items.length === 0) { setError('Add at least one service item'); return }
    setSaving(true)
    const qn = generateQuoteNumber()
    const expires = new Date()
    expires.setDate(expires.getDate() + 30)
    const { data, error: e } = await supabase.from('quotes').insert({
      client_id: clientId,
      quote_number: qn,
      items,
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
    if (e) { setError('Error saving: ' + e.message); return }
    router.push(`/quotes/${data.id}`)
  }

  const vehicleRules = rules.filter(r => VEHICLE_SERVICES.includes(r.service_type))
  const flatRules = rules.filter(r => FLAT_SERVICES.includes(r.service_type))
  const feeRules = rules.filter(r => FEE_SERVICES.includes(r.service_type))

  if (loading) return <div className="flex items-center justify-center h-screen text-gray-400">Loading pricing engine...</div>

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

            {/* ── CLIENT ── */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900">Client</h2>
                {leads.length > 0 && (
                  <button onClick={() => setShowLeadImport(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition-colors">
                    <UserPlus size={13}/>Import from Lead
                  </button>
                )}
              </div>

              {/* Lead import panel */}
              {showLeadImport && (
                <div className="mb-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
                  <p className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">Convert Lead → Client</p>
                  <div className="flex gap-2">
                    <select value={selectedLead} onChange={e => setSelectedLead(e.target.value)}
                      className="flex-1 border border-orange-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
                      <option value="">Select a lead...</option>
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.name}{l.company ? ` — ${l.company}` : ''}{l.service_interest ? ` · ${l.service_interest}` : ''}
                        </option>
                      ))}
                    </select>
                    <button onClick={convertLeadToClient} disabled={!selectedLead || convertingLead}
                      className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                      {convertingLead ? 'Converting...' : 'Convert & Select'}
                    </button>
                  </div>
                  <p className="text-xs text-orange-600 mt-2">This will create a client record and mark the lead as won.</p>
                </div>
              )}

              <select value={clientId} onChange={e => setClientId(e.target.value)} className={ic} style={{colorScheme:'light'}}>
                <option value="">Select a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
              </select>
              {clients.length === 0 && !leads.length && (
                <p className="text-xs text-orange-500 mt-2">No clients yet. <a href="/clients" className="underline font-semibold">Add one</a> or <a href="/leads" className="underline font-semibold">create a lead first →</a></p>
              )}
            </div>

            {/* ── ADD SERVICE ── */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-5">Add Service</h2>

              {/* Service selector */}
              <div className="mb-5">
                <label className={lb}>Service Type</label>
                <div className="space-y-2">
                  {[
                    { title: '🚛 Vehicle Wraps', group: vehicleRules },
                    { title: '🖼️ Flat Surfaces', group: flatRules },
                    { title: '⚙️ Fees', group: feeRules },
                  ].map(({ title, group }) => (
                    <div key={title}>
                      <p className="text-xs text-gray-400 font-semibold mb-1.5">{title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.map(r => (
                          <button key={r.service_type}
                            onClick={() => setSelectedRule(r)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              selectedRule?.service_type === r.service_type
                                ? 'bg-orange-500 text-white border-orange-500'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300'
                            }`}>
                            {r.label}
                            {r.is_default && <span className="ml-1 opacity-50">*</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">* Default market pricing — editable in Pricing Admin</p>
              </div>

              {selectedRule && (
                <div className="border-t border-gray-100 pt-5 space-y-4">

                  {/* ── DIMENSION INPUTS (dynamic by mode) ── */}
                  <div className="grid grid-cols-2 gap-4">
                    {isVehicle && (
                      <div>
                        <label className={lb}>Vehicle Length — L (feet)</label>
                        <input type="number" min={1} value={L}
                          onChange={e => setL(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 20" className={ic}/>
                        {computedSqft > 0 && (
                          <p className="text-xs text-orange-500 mt-1 font-medium">→ {computedSqft} sq ft</p>
                        )}
                      </div>
                    )}

                    {isWH && (
                      <>
                        <div>
                          <label className={lb}>Width (feet)</label>
                          <input type="number" min={0.1} step={0.1} value={W}
                            onChange={e => setW(e.target.value ? Number(e.target.value) : '')}
                            placeholder="e.g. 12" className={ic}/>
                        </div>
                        <div>
                          <label className={lb}>Height (feet)</label>
                          <input type="number" min={0.1} step={0.1} value={H}
                            onChange={e => setH(e.target.value ? Number(e.target.value) : '')}
                            placeholder="e.g. 8" className={ic}/>
                          {computedSqft > 0 && (
                            <p className="text-xs text-orange-500 mt-1 font-medium">→ {computedSqft} sq ft</p>
                          )}
                        </div>
                      </>
                    )}

                    {isFlat && !isWH && (
                      <div>
                        <label className={lb}>Square Feet</label>
                        <input type="number" min={1} value={sqftManual}
                          onChange={e => setSqftManual(e.target.value ? Number(e.target.value) : '')}
                          placeholder="e.g. 100" className={ic}/>
                      </div>
                    )}

                    {!isFee && (
                      <div>
                        <label className={lb}>Price Override <span className="text-gray-400 font-normal">(optional)</span></label>
                        <input type="number" value={manualPrice}
                          onChange={e => setManualPrice(e.target.value ? Number(e.target.value) : '')}
                          placeholder="Auto-calculated" className={ic}/>
                      </div>
                    )}
                  </div>

                  {/* ── MATERIAL ── */}
                  {!isFee && (
                    <div>
                      <label className={lb}>Material</label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {(Object.entries(MATERIAL_LABELS) as [MaterialType, string][]).map(([key, label]) => (
                          <button key={key} onClick={() => setMaterial(key)}
                            className={`py-2 px-1 rounded-lg text-xs font-semibold border text-center transition-colors leading-tight ${
                              material === key
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                            }`}>
                            {key === '3m' ? '3M' : key === 'gf' ? 'GF' : key.charAt(0).toUpperCase() + key.slice(1)}
                            <span className={`block text-xs mt-0.5 font-normal ${material === key ? 'text-gray-300' : 'text-gray-400'}`}>
                              ×{MATERIAL_MULTIPLIERS[key].toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{MATERIAL_LABELS[material]}</p>
                    </div>
                  )}

                  {/* ── COMPLEXITY ── */}
                  {!isFee && (
                    <div>
                      <label className={lb}>Complexity</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['simple','medium','complex'] as ComplexityLevel[]).map(level => (
                          <button key={level} onClick={() => setComplexity(level)}
                            className={`py-2.5 rounded-lg text-xs font-semibold border transition-colors text-center ${
                              complexity === level
                                ? level === 'simple' ? 'bg-green-500 text-white border-green-500'
                                  : level === 'medium' ? 'bg-yellow-500 text-white border-yellow-500'
                                  : 'bg-red-500 text-white border-red-500'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                            <span className={`block text-xs mt-0.5 font-normal ${complexity === level ? 'opacity-80' : 'text-gray-400'}`}>
                              ×{COMPLEXITY_MULTIPLIERS[level].toFixed(2)}
                            </span>
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{COMPLEXITY_LABELS[complexity]}</p>
                    </div>
                  )}

                  {/* Description + Notes */}
                  <div>
                    <label className={lb}>Description</label>
                    <input type="text" value={itemDesc} onChange={e => setItemDesc(e.target.value)}
                      placeholder={selectedRule.label} className={ic}/>
                  </div>
                  <div>
                    <label className={lb}>Item Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                    <input type="text" value={itemNotes} onChange={e => setItemNotes(e.target.value)}
                      placeholder="e.g. Includes 3 free T-shirts with logo" className={ic}/>
                  </div>

                  {/* ── PRICE BREAKDOWN + ADD ── */}
                  <div className="bg-orange-50 border border-orange-100 rounded-xl px-5 py-4">
                    {/* Breakdown */}
                    {!isFee && basePrice > 0 && manualPrice === '' && (
                      <div className="mb-3 pb-3 border-b border-orange-100 text-xs text-orange-600 space-y-1">
                        <div className="flex justify-between">
                          <span>
                            {isVehicle
                              ? `${computedSqft} sq ft × $${selectedRule.price_per_sqft}/sqft`
                              : isWH
                                ? `${W} ft × ${H} ft = ${computedSqft} sq ft × $${selectedRule.price_per_sqft}/sqft`
                                : `${computedSqft} sq ft × $${selectedRule.price_per_sqft}/sqft`
                            }
                          </span>
                          <span className="font-semibold">{formatCurrency(basePrice)}</span>
                        </div>
                        {cMult !== 1 && (
                          <div className="flex justify-between">
                            <span>Complexity ({complexity}) ×{cMult}</span>
                            <span className="font-semibold">+{formatCurrency(basePrice * (cMult - 1))}</span>
                          </div>
                        )}
                        {mMult !== 1 && (
                          <div className="flex justify-between">
                            <span>Material ({material.toUpperCase()}) ×{mMult}</span>
                            <span className="font-semibold">+{formatCurrency(basePrice * cMult * (mMult - 1))}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-orange-500 uppercase tracking-wide mb-1">
                          <Calculator size={12} className="inline mr-1"/>
                          {isFee ? 'Fixed Fee' : 'Estimated Price'}
                        </p>
                        {preview > 0
                          ? <p className="text-2xl font-bold text-orange-600">{formatCurrency(preview)}</p>
                          : <p className="text-gray-400 text-sm">
                              {isVehicle ? 'Enter L above' : isWH ? 'Enter W × H above' : isFlat ? 'Enter sq ft' : formatCurrency(selectedRule.base_price || 0)}
                            </p>
                        }
                        {selectedRule.min_price && preview > 0 && preview < selectedRule.min_price && (
                          <p className="text-xs text-red-500 mt-1">⚠ Below minimum of {formatCurrency(selectedRule.min_price)}</p>
                        )}
                      </div>
                      <button onClick={addItem}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-6 py-3 rounded-xl text-sm font-bold shadow-sm transition-colors">
                        <Plus size={18}/>Add Item
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── ITEMS LIST ── */}
            {items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                <h2 className="font-bold text-gray-900 mb-4">
                  Quote Items <span className="text-gray-400 font-normal text-sm">({items.length})</span>
                </h2>
                <div className="space-y-3">
                  {items.map(item => (
                    <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{item.label}</p>
                        <p className="text-gray-600 text-xs mt-0.5">{item.description}</p>
                        {/* Breakdown row */}
                        <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                          {item.L && <span>L: {item.L} ft</span>}
                          {item.W && item.H && <span>{item.W} ft × {item.H} ft</span>}
                          {item.sqft > 0 && <span>{item.sqft} sq ft</span>}
                          {item.price_per_sqft > 0 && <span>${item.price_per_sqft}/sqft</span>}
                          {item.material && <span className="uppercase">{item.material}</span>}
                          {item.complexity !== 'simple' && (
                            <span className={item.complexity === 'complex' ? 'text-red-400' : 'text-yellow-500'}>
                              {item.complexity} ×{item.complexity_multiplier}
                            </span>
                          )}
                        </div>
                        {/* Price breakdown */}
                        {item.base_price > 0 && item.base_price !== item.subtotal && (
                          <p className="text-xs text-gray-400 mt-1">
                            Base {formatCurrency(item.base_price)} → after multipliers
                          </p>
                        )}
                        {item.notes && <p className="text-xs text-gray-400 italic mt-1">{item.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div>
                          <p className="text-xs text-gray-400 text-center mb-1">Subtotal</p>
                          <input type="number" value={item.subtotal}
                            onChange={e => updateSubtotal(item.id, Number(e.target.value))}
                            className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                        </div>
                        <button onClick={() => removeItem(item.id)}
                          className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NOTES ── */}
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-4">Quote Notes</h2>
              <textarea value={quoteNotes} onChange={e => setQuoteNotes(e.target.value)} rows={3}
                placeholder="Timeline, special instructions, included items (e.g. 3 free T-shirts with logo)..."
                className={ic} style={{resize:'none'}}/>
            </div>
          </div>

          {/* ── SUMMARY SIDEBAR ── */}
          <div>
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm sticky top-6">
              <h2 className="font-bold text-gray-900 mb-5">Quote Summary</h2>
              <div className="space-y-3 mb-5">
                {[
                  { l: 'Items', v: items.length },
                  { l: 'Subtotal', v: formatCurrency(totals.subtotal) },
                  { l: 'Tax (NC 6.75%)', v: formatCurrency(totals.tax) },
                ].map(r => (
                  <div key={r.l} className="flex justify-between text-sm">
                    <span className="text-gray-500">{r.l}</span>
                    <span className="font-semibold text-gray-800">{r.v}</span>
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
                <p>• Valid 30 days from today</p>
                <p>• 1-year workmanship warranty</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
