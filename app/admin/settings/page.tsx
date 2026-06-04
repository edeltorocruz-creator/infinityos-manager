'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { BUSINESS_CONFIGS, setActiveBusinessType, getActiveConfig, type BusinessType, type BusinessConfig } from '@/lib/business-config'
import { CheckCircle, Building2, Wrench, Leaf, Sparkles, Paintbrush } from 'lucide-react'

const TYPE_ICONS: Record<string, any> = {
  wrap:        { icon: '∞',  color: '#ff6b00', label: 'Vehicle Wrap' },
  cleaning:    { icon: '✦',  color: '#3b82f6', label: 'Cleaning' },
  remodeling:  { icon: '⚒', color: '#8b5cf6', label: 'Remodeling' },
  landscaping: { icon: '🌿', color: '#10b981', label: 'Landscaping' },
  general:     { icon: '⚡', color: '#6b7280', label: 'General Services' },
}

export default function BusinessSettingsPage() {
  const [active, setActive] = useState<BusinessType>('wrap')
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    const s = localStorage.getItem('business_type') as BusinessType
    if (s) setActive(s)
  }, [])

  function select(type: BusinessType) {
    setActive(type)
    setActiveBusinessType(type)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const current = BUSINESS_CONFIGS[active]

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Business Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Choose your business type to configure services, pricing defaults, and quote templates.</p>
        </div>

        {saved && (
          <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> Business type updated — quote services will reflect this.
          </div>
        )}

        {/* Business Type Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {Object.entries(BUSINESS_CONFIGS).map(([type, cfg]) => {
            const meta = TYPE_ICONS[type]
            const isActive = active === type
            return (
              <button key={type} onClick={() => select(type as BusinessType)}
                className={`p-5 rounded-xl border-2 text-left transition-all ${
                  isActive
                    ? 'border-orange-400 bg-orange-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/30'
                }`}>
                <div className="text-2xl mb-2">{meta.icon}</div>
                <p className="font-semibold text-gray-900 text-sm">{meta.label}</p>
                <p className="text-xs text-gray-500 mt-1">{cfg.services.length} services</p>
                {isActive && <span className="mt-2 inline-block text-xs font-bold text-orange-600">✓ Active</span>}
              </button>
            )
          })}
        </div>

        {/* Services Preview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-900 mb-1">{current.name}</h2>
          <p className="text-xs text-gray-500 mb-4">{current.services.length} services configured</p>

          {Array.from(new Set(current.services.map(s => s.category))).map(cat => (
            <div key={cat} className="mb-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{cat}</p>
              <div className="grid grid-cols-2 gap-2">
                {current.services.filter(s => s.category === cat).map(svc => (
                  <div key={svc.id} className="flex justify-between items-center px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700">{svc.label}</span>
                    <span className="text-xs text-gray-400 font-mono">
                      ${svc.defaultPrice}/{svc.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700 font-medium">Quote Terms Preview</p>
            <pre className="text-xs text-blue-600 mt-1 whitespace-pre-wrap font-sans">{current.quoteTerms}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}
