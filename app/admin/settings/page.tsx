'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { CheckCircle, Save, Building2 } from 'lucide-react'

interface BizProfile {
  id: string
  name: string
  type: string
  phone: string
  email: string
  website: string
  address: string
  instagram: string
  facebook: string
  logo_text: string
  warranty_text: string
  terms_text: string
  is_active: boolean
  tax_rate: number
  deposit_rate: number
}

const TYPE_META: Record<string, { icon: string; label: string }> = {
  wrap:        { icon: '∞',  label: 'Vehicle Wrap' },
  cleaning:    { icon: '✦',  label: 'Cleaning' },
  remodeling:  { icon: '⚒', label: 'Remodeling' },
  landscaping: { icon: '🌿', label: 'Landscaping' },
  general:     { icon: '⚡', label: 'General Services' },
}

export default function BusinessSettingsPage() {
  const [profiles,  setProfiles]  = useState<BizProfile[]>([])
  const [active,    setActive]    = useState<string>('')
  const [editing,   setEditing]   = useState<BizProfile | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    supabase.from('business_profiles').select('*').order('is_active', { ascending: false }).order('name')
      .then(({ data }) => {
        if (data) {
          setProfiles(data)
          const act = data.find(p => p.is_active)
          if (act) setActive(act.id)
        }
        setLoading(false)
      })
  }, [])

  async function setActiveProfile(id: string) {
    setSaving(true)
    // Deactivate all, activate selected
    await supabase.from('business_profiles').update({ is_active: false }).neq('id', id)
    await supabase.from('business_profiles').update({ is_active: true }).eq('id', id)
    setActive(id)
    setProfiles(p => p.map(x => ({ ...x, is_active: x.id === id })))
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function saveEdits() {
    if (!editing) return
    setSaving(true)
    const { error } = await supabase.from('business_profiles').update({
      name: editing.name, phone: editing.phone, email: editing.email,
      website: editing.website, address: editing.address,
      instagram: editing.instagram, facebook: editing.facebook,
      logo_text: editing.logo_text, warranty_text: editing.warranty_text,
      terms_text: editing.terms_text,
      tax_rate: editing.tax_rate, deposit_rate: editing.deposit_rate,
      updated_at: new Date().toISOString(),
    }).eq('id', editing.id)
    setSaving(false)
    if (!error) {
      setProfiles(p => p.map(x => x.id === editing.id ? { ...editing } : x))
      setEditing(null)
      setSaved(true); setTimeout(() => setSaved(false), 2500)
    }
  }

  const currentProfile = profiles.find(p => p.id === active)
  const inp = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
  const textArea = inp + " resize-none"

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-sm">Loading business settings...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Choose and configure your active business profile. Affects quotes, invoices, and PDFs.</p>
        </div>

        {saved && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Saved to database ✓
          </div>
        )}

        {/* Profile Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {profiles.map(p => {
            const meta = TYPE_META[p.type] || TYPE_META.general
            const isAct = p.id === active
            return (
              <div key={p.id}
                className={`p-4 rounded-xl border-2 transition-all ${isAct ? 'border-orange-400 bg-orange-50 shadow-sm' : 'border-gray-200 bg-white hover:border-orange-200'}`}>
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl">{meta.icon}</span>
                  {isAct && <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Active</span>}
                </div>
                <p className="font-semibold text-gray-900 text-sm">{p.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{meta.label}</p>
                <div className="mt-3 flex gap-2">
                  {!isAct && (
                    <button onClick={() => setActiveProfile(p.id)} disabled={saving}
                      className="flex-1 text-xs bg-orange-500 hover:bg-orange-600 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50">
                      Set Active
                    </button>
                  )}
                  <button onClick={() => setEditing({ ...p })}
                    className="flex-1 text-xs border border-gray-200 hover:bg-gray-50 text-gray-600 py-1.5 rounded-lg font-semibold">
                    Edit
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Active Profile Preview */}
        {currentProfile && !editing && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-900">{currentProfile.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Active business — used in all quotes and PDFs</p>
              </div>
              <button onClick={() => setEditing({ ...currentProfile })}
                className="text-sm text-orange-500 hover:text-orange-600 font-medium">
                Edit details →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Phone', currentProfile.phone],
                ['Email', currentProfile.email],
                ['Website', currentProfile.website],
                ['Address', currentProfile.address],
                ['Instagram', currentProfile.instagram],
                ['Facebook', currentProfile.facebook],
                ['Tax Rate', `${(currentProfile.tax_rate*100).toFixed(2)}%`],
                ['Deposit Rate', `${(currentProfile.deposit_rate*100).toFixed(0)}%`],
              ].map(([label, val]) => val ? (
                <div key={label} className="flex gap-2">
                  <span className="text-gray-400 w-20 shrink-0">{label}</span>
                  <span className="text-gray-700 font-medium truncate">{val}</span>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {/* Edit Form */}
        {editing && (
          <div className="bg-white rounded-xl border border-orange-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-gray-900">Edit: {editing.name}</h2>
              <div className="flex gap-2">
                <button onClick={() => setEditing(null)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                  Cancel
                </button>
                <button onClick={saveEdits} disabled={saving}
                  className="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save to DB'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {([
                ['Business Name', 'name', 'text'],
                ['Phone', 'phone', 'text'],
                ['Email', 'email', 'email'],
                ['Website', 'website', 'text'],
                ['Address', 'address', 'text'],
                ['Instagram', 'instagram', 'text'],
                ['Facebook', 'facebook', 'text'],
                ['Logo Text (2 chars)', 'logo_text', 'text'],
              ] as [string, keyof BizProfile, string][]).map(([label, field, type]) => (
                <div key={field}>
                  <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
                  <input type={type} value={String(editing[field] || '')}
                    onChange={e => setEditing(prev => prev ? { ...prev, [field]: e.target.value } : prev)}
                    className={inp} />
                </div>
              ))}
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Tax Rate (%)</label>
                <input type="number" step="0.01" value={(editing.tax_rate * 100).toFixed(2)}
                  onChange={e => setEditing(prev => prev ? { ...prev, tax_rate: parseFloat(e.target.value)/100 || 0.0675 } : prev)}
                  className={inp} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Deposit Rate (%)</label>
                <input type="number" step="1" value={(editing.deposit_rate * 100).toFixed(0)}
                  onChange={e => setEditing(prev => prev ? { ...prev, deposit_rate: parseFloat(e.target.value)/100 || 0.5 } : prev)}
                  className={inp} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Warranty Text</label>
                <textarea value={editing.warranty_text || ''}
                  onChange={e => setEditing(prev => prev ? { ...prev, warranty_text: e.target.value } : prev)}
                  rows={2} className={textArea} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-500 block mb-1">Terms & Conditions</label>
                <textarea value={editing.terms_text || ''}
                  onChange={e => setEditing(prev => prev ? { ...prev, terms_text: e.target.value } : prev)}
                  rows={5} className={textArea} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
