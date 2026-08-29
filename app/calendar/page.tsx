'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Appointment } from '@/types'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Clock, MapPin } from 'lucide-react'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Calendario LOCAL — usa la tabla `appointments` de Supabase, no Google Calendar
// (decisión explícita de Eduardo: "El calendario puede ser local").
export default function CalendarPage() {
  const now = new Date()
  const todayStr = ymd(now)
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [appts, setAppts] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', date: todayStr, startTime: '09:00', endTime: '10:00', location: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('appointments').select('*').order('start_time')
    setAppts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  function apptsOn(dateStr: string): Appointment[] {
    return appts.filter(a => a.start_time.slice(0, 10) === dateStr)
  }

  const today = apptsOn(todayStr)
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7)
  const thisWeek = appts.filter(a => {
    const d = a.start_time.slice(0, 10)
    return d > todayStr && d <= ymd(in7)
  })

  // Grid del mes
  const firstDay   = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad   = firstDay.getDay()
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function openNew(dateStr?: string) {
    setForm({ title: '', date: dateStr || todayStr, startTime: '09:00', endTime: '10:00', location: '', notes: '' })
    setShowForm(true)
  }

  async function saveAppt() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('appointments').insert({
      title: form.title.trim(),
      start_time: `${form.date}T${form.startTime}:00`,
      end_time: `${form.date}T${form.endTime}:00`,
      location: form.location || null,
      notes: form.notes || null,
    })
    setSaving(false)
    setShowForm(false)
    load()
  }

  async function deleteAppt(id: string) {
    if (!confirm('¿Borrar este evento?')) return
    await supabase.from('appointments').delete().eq('id', id)
    load()
  }

  const dayList = (title: string, list: Appointment[], color: string) => (
    list.length > 0 && (
      <div className={`border rounded-xl p-4 ${color}`}>
        <p className="font-bold text-gray-800 mb-2">{title}</p>
        <div className="space-y-1.5">
          {list.map(a => (
            <div key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
              <Clock size={12} className="text-gray-400 shrink-0"/>
              <span className="font-medium">{new Date(a.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
              <span className="truncate">{a.title}</span>
              <button onClick={() => deleteAppt(a.id)} className="ml-auto text-gray-300 hover:text-red-500"><Trash2 size={12}/></button>
            </div>
          ))}
        </div>
      </div>
    )
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-gray-900">📅 Calendario</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => openNew()}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
              <Plus size={15}/>Nuevo evento
            </button>
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
              <span className="font-semibold text-gray-800 min-w-36 text-center">{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
            </div>
          </div>
        </div>

        {loading ? <p className="text-gray-400 text-sm">Cargando…</p> : (
          <>
            {dayList('⭐ Hoy', today, 'bg-orange-50 border-orange-200')}
            {dayList('📆 Esta semana', thisWeek, 'bg-white border-gray-200')}
            {today.length === 0 && thisWeek.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-700">
                ✅ Nada agendado hoy ni esta semana.
              </div>
            )}

            {/* Calendario */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} className="min-h-20" />
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                  const evs = apptsOn(dateStr)
                  const isToday = dateStr === todayStr
                  return (
                    <div key={i}
                      onClick={() => openNew(dateStr)}
                      className={`min-h-20 rounded-lg border p-1.5 text-xs cursor-pointer hover:border-orange-300 transition-colors ${
                        isToday ? 'border-orange-400 bg-orange-50' : 'border-gray-100'
                      }`}>
                      <p className={`font-semibold mb-1 ${isToday ? 'text-orange-600' : 'text-gray-600'}`}>{day}</p>
                      {evs.slice(0, 3).map(a => (
                        <div key={a.id} className="flex items-center gap-1 truncate text-gray-600" title={a.title}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-orange-500" />
                          <span className="truncate">{a.title}</span>
                        </div>
                      ))}
                      {evs.length > 3 && <p className="text-gray-400">+{evs.length - 3} más</p>}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── NEW APPOINTMENT MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Nuevo evento</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Título *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="Instalación, medición, entrega..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Fecha</label>
                <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Inicio</label>
                  <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Fin</label>
                  <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1"><MapPin size={11}/>Ubicación (opcional)</label>
                <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"/>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Notas</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"/>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-medium">Cancelar</button>
              <button onClick={saveAppt} disabled={saving || !form.title.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl font-bold">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
