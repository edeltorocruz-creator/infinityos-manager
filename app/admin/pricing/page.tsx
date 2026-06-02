'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import { Save, RefreshCw, AlertCircle, CheckCircle, Edit2 } from 'lucide-react'

const FORMULA_LABELS: Record<string, string> = {
  L_based: '🚛 L-based (vehicle)',
  flat_sqft: '📐 Per Sq Ft',
  flat_fee: '💲 Flat Fee',
}

export default function AdminPricingPage() {
  const [rules, setRules] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState<string | null>(null)

  useEffect(() => { loadRules() }, [])

  async function loadRules() {
    setLoading(true)
    const { data } = await supabase.from('pricing_rules').select('*').eq('active', true).order('category').order('label')
    if (data) setRules(data)
    setLoading(false)
  }

  async function saveRule(rule: any) {
    setSaving(rule.id)
    await supabase.from('pricing_rules').update({
      label: rule.label,
      price_per_sqft: rule.price_per_sqft,
      base_price: rule.base_price,
      min_price: rule.min_price,
      extra_rate: rule.extra_rate,
      sqft_multiplier_side: rule.sqft_multiplier_side,
      sqft_multiplier_top: rule.sqft_multiplier_top,
      material_rate: rule.material_rate,
      labor_rate: rule.labor_rate,
      is_default: false, // once you edit it, it's your real price
      updated_at: new Date().toISOString(),
    }).eq('id', rule.id)
    setSaving(null)
    setEditing(null)
    setSuccess(`✓ ${rule.label} updated`)
    setTimeout(() => setSuccess(''), 3000)
  }

  function updateField(id: string, field: string, value: any) {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  const grouped = rules.reduce((acc: any, r) => {
    acc[r.category] = acc[r.category] || []
    acc[r.category].push(r)
    return acc
  }, {})

  const catLabels: Record<string, string> = {
    vehicle: '🚛 Vehicle Wraps',
    flat_surface: '🖼️ Flat Surfaces',
    service_fee: '⚙️ Service Fees',
  }

  const ic = "border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 w-full"

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pricing Admin</h1>
            <p className="text-gray-500 mt-1">Edit your pricing rules · Changes save to database instantly</p>
          </div>
          <button onClick={loadRules} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold">
            <RefreshCw size={15}/>Refresh
          </button>
        </div>

        {success && <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium"><CheckCircle size={16}/>{success}</div>}

        <div className="mb-4 bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
          <AlertCircle size={16} className="text-blue-500 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-blue-700">
            <p className="font-bold mb-1">Default Editable Pricing (*)</p>
            <p>Items marked with * are based on NC market averages. Edit them to set your real prices — they will be used in all future quotes automatically.</p>
          </div>
        </div>

        {loading ? <div className="text-center py-20 text-gray-400">Loading pricing rules...</div> : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, catRules]: any) => (
              <div key={cat}>
                <h2 className="text-lg font-bold text-gray-900 mb-4">{catLabels[cat] || cat}</h2>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs font-bold text-gray-500 uppercase tracking-wide">Service</th>
                        <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Formula</th>
                        {cat === 'vehicle' && <>
                          <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">$/sqft</th>
                          <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Extra/sqft</th>
                          <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Side (ft)</th>
                          <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Top (ft)</th>
                        </>}
                        {cat === 'flat_surface' && <>
                          <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">$/sqft</th>
                        </>}
                        {cat === 'service_fee' && <>
                          <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Base Price</th>
                        </>}
                        <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Min Price</th>
                        <th className="text-center py-3 px-3 text-xs font-bold text-gray-500 uppercase tracking-wide">Status</th>
                        <th className="py-3 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {catRules.map((rule: any) => (
                        <tr key={rule.id} className={`border-b border-gray-50 ${editing === rule.id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {rule.label}
                                {rule.is_default && <span className="text-orange-400 ml-1">*</span>}
                              </p>
                              {rule.notes && <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{rule.notes}</p>}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{FORMULA_LABELS[rule.formula] || rule.formula}</span>
                          </td>

                          {cat === 'vehicle' && <>
                            <td className="py-3 px-3">
                              <input type="number" step="0.01" value={rule.price_per_sqft || ''} disabled={editing !== rule.id}
                                onChange={e => updateField(rule.id, 'price_per_sqft', Number(e.target.value))}
                                className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                            </td>
                            <td className="py-3 px-3">
                              <input type="number" step="0.01" value={rule.extra_rate || ''} disabled={editing !== rule.id}
                                onChange={e => updateField(rule.id, 'extra_rate', Number(e.target.value))}
                                className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                            </td>
                            <td className="py-3 px-3">
                              <input type="number" step="0.5" value={rule.sqft_multiplier_side || ''} disabled={editing !== rule.id}
                                onChange={e => updateField(rule.id, 'sqft_multiplier_side', Number(e.target.value))}
                                className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                            </td>
                            <td className="py-3 px-3">
                              <input type="number" step="0.5" value={rule.sqft_multiplier_top || ''} disabled={editing !== rule.id}
                                onChange={e => updateField(rule.id, 'sqft_multiplier_top', Number(e.target.value))}
                                className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                            </td>
                          </>}

                          {cat === 'flat_surface' && (
                            <td className="py-3 px-3">
                              <input type="number" step="0.01" value={rule.price_per_sqft || ''} disabled={editing !== rule.id}
                                onChange={e => updateField(rule.id, 'price_per_sqft', Number(e.target.value))}
                                className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                            </td>
                          )}

                          {cat === 'service_fee' && (
                            <td className="py-3 px-3">
                              <input type="number" step="1" value={rule.base_price || ''} disabled={editing !== rule.id}
                                onChange={e => updateField(rule.id, 'base_price', Number(e.target.value))}
                                className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                            </td>
                          )}

                          <td className="py-3 px-3">
                            <input type="number" step="1" value={rule.min_price || ''} disabled={editing !== rule.id}
                              onChange={e => updateField(rule.id, 'min_price', Number(e.target.value))}
                              className={ic + (editing !== rule.id ? ' bg-gray-50 text-gray-500' : '')}/>
                          </td>

                          <td className="py-3 px-3 text-center">
                            {rule.is_default
                              ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">Default *</span>
                              : <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">✓ Your Price</span>
                            }
                          </td>

                          <td className="py-3 px-3">
                            {editing === rule.id ? (
                              <div className="flex gap-1">
                                <button onClick={() => saveRule(rule)} disabled={saving === rule.id}
                                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                                  {saving === rule.id ? '...' : 'Save'}
                                </button>
                                <button onClick={() => { setEditing(null); loadRules(); }}
                                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-semibold">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setEditing(rule.id)}
                                className="text-gray-400 hover:text-orange-500 p-1.5 hover:bg-orange-50 rounded-lg transition-colors">
                                <Edit2 size={15}/>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
