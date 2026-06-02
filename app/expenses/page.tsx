'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/quote-engine'
import {
  Plus, Search, Receipt, Trash2, Edit2, TrendingDown,
  Camera, Upload, Sparkles, X, CheckCircle, AlertCircle,
  Loader, Eye, Download
} from 'lucide-react'

const CATEGORIES = [
  'Materials', 'Equipment', 'Vehicle', 'Labor', 'Marketing',
  'Software', 'Supplies', 'Fuel', 'Insurance', 'Other'
]

// Category keyword map for auto-detection
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Materials:  ['vinyl', 'wrap', 'film', '3m', 'avery', 'laminate', 'ink', 'primer', 'cleaner', 'squeegee'],
  Equipment:  ['tool', 'cutter', 'plotter', 'heat gun', 'printer', 'blade', 'knife', 'machine'],
  Vehicle:    ['gas', 'fuel', 'tire', 'oil', 'car wash', 'repair', 'auto', 'truck', 'mileage'],
  Labor:      ['labor', 'install', 'helper', 'contractor', 'subcontract', 'worker', 'staff'],
  Marketing:  ['facebook', 'instagram', 'google', 'ad', 'flyer', 'business card', 'sign', 'promotion'],
  Software:   ['subscription', 'software', 'app', 'saas', 'hosting', 'domain', 'license'],
  Supplies:   ['office', 'supply', 'paper', 'tape', 'glove', 'mask', 'cleaning'],
  Fuel:       ['shell', 'bp', 'exxon', 'chevron', 'gas station', 'diesel', 'petrol'],
  Insurance:  ['insurance', 'policy', 'premium', 'liability', 'coverage'],
}

function guessCategory(text: string): string {
  const lower = text.toLowerCase()
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat
  }
  return 'Other'
}

interface Expense {
  id: string
  description: string
  amount: number
  category: string
  vendor: string | null
  date: string
  notes: string | null
  receipt_url: string | null
  ocr_raw: string | null
  ocr_confidence: string | null
  created_at: string
}

type OCRState = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

const EMPTY_FORM = {
  description: '', amount: '', category: 'Materials',
  vendor: '', date: new Date().toISOString().split('T')[0], notes: ''
}

const ic = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white text-gray-800"
const lb = "text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block"

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterMonth, setFilterMonth] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // OCR state
  const [ocrState, setOcrState] = useState<OCRState>('idle')
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const [ocrRaw, setOcrRaw] = useState('')
  const [ocrError, setOcrError] = useState('')
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [showOCR, setShowOCR] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadExpenses() }, [])

  async function loadExpenses() {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
    if (data) setExpenses(data as Expense[])
    setLoading(false)
  }

  // ── OCR ENGINE ──
  async function handleImageSelect(file: File) {
    if (!file) return
    setOcrState('uploading')
    setOcrError('')

    // Preview
    const reader = new FileReader()
    reader.onload = (e) => setOcrPreview(e.target?.result as string)
    reader.readAsDataURL(file)

    try {
      // 1. Upload to Supabase Storage
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const filename = `receipt-${Date.now()}.${ext}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(filename, file, { contentType: file.type, upsert: false })

      if (uploadError) throw new Error('Upload failed: ' + uploadError.message)

      // Get public URL
      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(filename)
      const publicUrl = urlData.publicUrl
      setUploadedUrl(publicUrl)

      // 2. Convert to base64 for Claude Vision
      setOcrState('analyzing')
      const base64 = await fileToBase64(file)
      const mediaType = file.type as 'image/jpeg' | 'image/png' | 'image/webp'

      // 3. Call Claude Vision API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are an expense receipt analyzer for Infinity Wrap Design, a vehicle wrap company in North Carolina. Extract information from receipts and return ONLY valid JSON, no markdown, no explanation.`,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 }
              },
              {
                type: 'text',
                text: `Analyze this receipt and extract the data. Return ONLY this JSON structure:
{
  "vendor": "store or company name",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "description": "brief description of what was purchased (max 60 chars)",
  "items": ["item1", "item2"],
  "category_hint": "one word describing the type: materials, fuel, supplies, equipment, food, or other",
  "confidence": "high|medium|low",
  "notes": "any relevant details"
}
If you cannot read a field clearly, use null. For date, default to today if unclear. Amount must be a number.`
              }
            ]
          }]
        })
      })

      const data = await response.json()
      const text = data.content?.find((c: any) => c.type === 'text')?.text || ''
      setOcrRaw(text)

      // 4. Parse and auto-fill form
      try {
        const clean = text.replace(/```json|```/g, '').trim()
        const parsed = JSON.parse(clean)

        const description = parsed.description || (parsed.items?.[0] || 'Receipt expense')
        const autoCategory = guessCategory(
          [description, parsed.vendor, parsed.category_hint, ...(parsed.items || [])].join(' ')
        )

        setForm({
          description: description.slice(0, 100),
          amount: parsed.amount ? String(parsed.amount) : '',
          category: autoCategory,
          vendor: parsed.vendor || '',
          date: parsed.date || new Date().toISOString().split('T')[0],
          notes: parsed.items?.length > 1 ? 'Items: ' + parsed.items.join(', ') : (parsed.notes || ''),
        })
        setOcrState('done')
      } catch {
        // Partial extraction — show raw and let user fill
        setOcrState('done')
        setOcrError('Could not parse all fields automatically. Review and complete manually.')
      }
    } catch (err: any) {
      setOcrState('error')
      setOcrError(err.message || 'Unknown error')
    }
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  function openNewManual() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOcrPreview(null)
    setUploadedUrl(null)
    setOcrState('idle')
    setOcrRaw('')
    setOcrError('')
    setShowForm(true)
    setShowOCR(false)
  }

  function openOCR() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setOcrPreview(null)
    setUploadedUrl(null)
    setOcrState('idle')
    setOcrRaw('')
    setOcrError('')
    setShowOCR(true)
    setShowForm(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({
      description: e.description, amount: String(e.amount),
      category: e.category, vendor: e.vendor || '',
      date: e.date, notes: e.notes || ''
    })
    setOcrPreview(e.receipt_url || null)
    setUploadedUrl(e.receipt_url || null)
    setOcrState('idle')
    setShowForm(true)
    setShowOCR(false)
  }

  async function saveExpense() {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    const payload: any = {
      description: form.description,
      amount: parseFloat(form.amount),
      category: form.category,
      vendor: form.vendor || null,
      date: form.date,
      notes: form.notes || null,
      receipt_url: uploadedUrl || null,
      ocr_raw: ocrRaw || null,
      ocr_confidence: ocrState === 'done' ? 'auto' : null,
    }
    if (editing) {
      await supabase.from('expenses').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('expenses').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setShowOCR(false)
    setOcrPreview(null)
    setUploadedUrl(null)
    setOcrState('idle')
    loadExpenses()
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this expense?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadExpenses()
  }

  const months = [...new Set(expenses.map(e => e.date.slice(0, 7)))].sort().reverse()

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.vendor || '').toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'all' || e.category === filterCat
    const matchMonth = filterMonth === 'all' || e.date.startsWith(filterMonth)
    return matchSearch && matchCat && matchMonth
  })

  const total = filtered.reduce((s, e) => s + e.amount, 0)
  const byCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filtered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingDown size={26} className="text-orange-500"/> Expenses
            </h1>
            <p className="text-gray-500 mt-1">Track & categorize — Infinity Wrap Design</p>
          </div>
          <div className="flex gap-2">
            <button onClick={openOCR}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm">
              <Camera size={16} className="text-orange-400"/>
              <span>Scan Receipt</span>
              <span className="bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">AI</span>
            </button>
            <button onClick={openNewManual}
              className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-xl font-semibold transition-colors text-sm">
              <Plus size={16}/>Manual
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 col-span-2 md:col-span-1">
            <p className="text-gray-400 text-xs mb-1">Total (filtered)</p>
            <p className="text-2xl font-bold text-red-500">{formatCurrency(total)}</p>
          </div>
          {Object.entries(byCategory)
            .filter(([, v]) => v > 0)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat, val]) => (
              <div key={cat} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-gray-400 text-xs mb-1">{cat}</p>
                <p className="text-xl font-bold text-gray-700">{formatCurrency(val)}</p>
              </div>
            ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search size={14} className="absolute left-3 top-3 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="all">All months</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Expense list */}
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading expenses...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <Receipt size={44} className="mx-auto text-gray-300 mb-4"/>
            <p className="text-gray-500 text-lg font-medium">No expenses yet</p>
            <p className="text-gray-400 text-sm mt-1">Scan a receipt or add manually</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(expense => (
              <div key={expense.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4 flex items-center gap-4">
                {/* Receipt thumbnail */}
                {expense.receipt_url ? (
                  <a href={expense.receipt_url} target="_blank" rel="noreferrer"
                    className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100 hover:opacity-80 transition-opacity">
                    <img src={expense.receipt_url} alt="receipt" className="w-full h-full object-cover"/>
                  </a>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <Receipt size={18} className="text-gray-300"/>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{expense.description}</p>
                    {expense.ocr_confidence === 'auto' && (
                      <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                        <Sparkles size={10}/>AI
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-0.5 text-xs text-gray-400">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{expense.category}</span>
                    {expense.vendor && <span>{expense.vendor}</span>}
                    <span>{new Date(expense.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  {expense.notes && <p className="text-xs text-gray-400 italic mt-0.5 truncate">{expense.notes}</p>}
                </div>

                <p className="text-lg font-bold text-red-500 flex-shrink-0">{formatCurrency(expense.amount)}</p>

                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(expense)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"><Edit2 size={14}/></button>
                  <button onClick={() => deleteExpense(expense.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── FORM MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {editing ? 'Edit Expense' : showOCR ? '📷 Scan Receipt' : 'New Expense'}
                </h2>
                {showOCR && ocrState === 'idle' && (
                  <p className="text-sm text-gray-400 mt-0.5">Take a photo or upload — AI extracts everything automatically</p>
                )}
              </div>
              <button onClick={() => { setShowForm(false); setShowOCR(false); setOcrPreview(null); setOcrState('idle') }}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18}/>
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── OCR SECTION ── */}
              {showOCR && (
                <div>
                  {/* Upload zone */}
                  {ocrState === 'idle' && !ocrPreview && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-orange-200 rounded-2xl p-10 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all">
                      <Camera size={40} className="mx-auto text-orange-300 mb-3"/>
                      <p className="font-semibold text-gray-700 text-lg">Tap to scan receipt</p>
                      <p className="text-gray-400 text-sm mt-1">Photo, screenshot, or PDF — AI will extract all fields</p>
                      <div className="flex justify-center gap-4 mt-4 text-xs text-gray-300">
                        <span>JPG · PNG · WEBP · PDF</span>
                        <span>Max 5MB</span>
                      </div>
                    </div>
                  )}

                  {/* Processing states */}
                  {ocrState === 'uploading' && (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <Loader size={32} className="text-orange-500 animate-spin"/>
                      <p className="font-semibold text-gray-700">Uploading receipt...</p>
                    </div>
                  )}
                  {ocrState === 'analyzing' && (
                    <div className="flex flex-col items-center py-10 gap-3">
                      <Sparkles size={32} className="text-purple-500 animate-pulse"/>
                      <p className="font-semibold text-gray-700">AI analyzing receipt...</p>
                      <p className="text-gray-400 text-sm">Extracting vendor, amount, date, items...</p>
                    </div>
                  )}

                  {/* Preview + done */}
                  {ocrPreview && ocrState !== 'uploading' && ocrState !== 'analyzing' && (
                    <div className="flex gap-4 mb-4">
                      <div className="flex-shrink-0">
                        <img src={ocrPreview} alt="receipt preview" className="w-28 h-36 object-cover rounded-xl border border-gray-200 shadow-sm"/>
                        {ocrState === 'done' && <p className="text-xs text-green-600 text-center mt-1 font-semibold flex items-center justify-center gap-1"><CheckCircle size={10}/>Scanned</p>}
                      </div>
                      <div className="flex-1">
                        {ocrState === 'done' && (
                          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-3">
                            <p className="text-xs font-bold text-purple-700 flex items-center gap-1 mb-1"><Sparkles size={11}/>AI extracted — review & confirm below</p>
                            {ocrError && <p className="text-xs text-orange-600">{ocrError}</p>}
                          </div>
                        )}
                        {ocrState === 'error' && (
                          <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
                            <p className="text-xs font-bold text-red-700 flex items-center gap-1 mb-1"><AlertCircle size={11}/>Error scanning</p>
                            <p className="text-xs text-red-600">{ocrError}</p>
                          </div>
                        )}
                        <button onClick={() => { setOcrPreview(null); setOcrState('idle'); setUploadedUrl(null); fileInputRef.current?.click() }}
                          className="text-xs text-orange-500 hover:text-orange-700 font-semibold flex items-center gap-1">
                          <Camera size={11}/>Scan different receipt
                        </button>
                      </div>
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleImageSelect(f) }}/>
                </div>
              )}

              {/* ── FORM FIELDS (shown always, auto-filled after OCR) ── */}
              {(ocrState === 'done' || ocrState === 'error' || !showOCR || editing) && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className={lb}>Description *</label>
                    <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                      placeholder="What was purchased?" className={ic}/>
                  </div>
                  <div>
                    <label className={lb}>Amount ($) *</label>
                    <input type="number" step="0.01" value={form.amount}
                      onChange={e => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00" className={ic}/>
                  </div>
                  <div>
                    <label className={lb}>Date</label>
                    <input type="date" value={form.date}
                      onChange={e => setForm({ ...form, date: e.target.value })} className={ic}/>
                  </div>
                  <div>
                    <label className={lb}>Category</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={ic}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lb}>Vendor</label>
                    <input value={form.vendor} onChange={e => setForm({ ...form, vendor: e.target.value })}
                      placeholder="Store or company name" className={ic}/>
                  </div>
                  <div className="col-span-2">
                    <label className={lb}>Notes</label>
                    <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                      rows={2} placeholder="Items purchased, project reference..."
                      className={ic} style={{ resize: 'none' }}/>
                  </div>
                </div>
              )}

              {/* Initial OCR state — show drop zone only */}
              {showOCR && ocrState === 'idle' && !ocrPreview && (
                <div className="text-center py-4">
                  <button onClick={openNewManual} className="text-sm text-gray-400 hover:text-gray-600 underline">
                    Skip scan — enter manually instead
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            {(ocrState === 'done' || ocrState === 'error' || !showOCR || editing) && (
              <div className="flex gap-3 p-6 border-t border-gray-100">
                <button onClick={() => { setShowForm(false); setShowOCR(false); setOcrPreview(null); setOcrState('idle') }}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button onClick={saveExpense} disabled={saving || !form.description.trim() || !form.amount}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold transition-colors flex items-center justify-center gap-2">
                  {saving ? <><Loader size={14} className="animate-spin"/>Saving...</> : <><CheckCircle size={14}/>{editing ? 'Update' : 'Save Expense'}</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
