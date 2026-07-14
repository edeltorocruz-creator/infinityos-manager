'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

type EventKind = 'followup' | 'invoice' | 'project_start' | 'project_end'

interface CalEvent {
  id: string
  kind: EventKind
  date: string       // YYYY-MM-DD
  label: string
  href: string
}

const KIND_STYLE: Record<EventKind, { dot: string; label: string }> = {
  followup:      { dot: 'bg-red-500',    label: 'Follow-up' },
  invoice:       { dot: 'bg-yellow-500', label: 'Invoice vence' },
  project_start: { dot: 'bg-blue-500',   label: 'Proyecto empieza' },
  project_end:   { dot: 'bg-green-500',  label: 'Proyecto termina' },
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarPage() {
  const now = new Date()
  const todayStr = ymd(now)
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [leads, invs, projs] = await Promise.all([
      supabase.from('leads').select('id,name,next_followup_at,status')
        .not('next_followup_at', 'is', null)
        .not('status', 'in', '("won","lost")'),
      supabase.from('invoices').select('id,invoice_number,due_date,status')
        .not('due_date', 'is', null)
        .neq('status', 'paid'),
      supabase.from('projects').select('id,name,start_date,end_date,status'),
    ])

    const evs: CalEvent[] = []
    for (const l of (leads.data || [])) {
      evs.push({ id: 'f' + l.id, kind: 'followup', date: l.next_followup_at!.slice(0, 10),
        label: `Contactar: ${l.name}`, href: '/followup' })
    }
    for (const i of (invs.data || [])) {
      evs.push({ id: 'i' + i.id, kind: 'invoice', date: i.due_date!.slice(0, 10),
        label: `Vence ${i.invoice_number}`, href: `/invoices/${i.id}` })
    }
    for (const p of (projs.data || [])) {
      if (p.start_date) evs.push({ id: 'ps' + p.id, kind: 'project_start', date: p.start_date.slice(0, 10),
        label: `Empieza: ${p.name}`, href: `/projects/${p.id}` })
      if (p.end_date) evs.push({ id: 'pe' + p.id, kind: 'project_end', date: p.end_date.slice(0, 10),
        label: `Termina: ${p.name}`, href: `/projects/${p.id}` })
    }
    setEvents(evs)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  // Alertas
  const overdue = events.filter(e => e.date < todayStr && (e.kind === 'followup' || e.kind === 'invoice'))
  const today   = events.filter(e => e.date === todayStr)
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7)
  const thisWeek = events.filter(e => e.date > todayStr && e.date <= ymd(in7))

  // Grid del mes
  const firstDay   = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startPad   = firstDay.getDay()
  const cells: (number | null)[] = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsOn(day: number): CalEvent[] {
    const ds = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return events.filter(e => e.date === ds)
  }

  const alertBox = (title: string, list: CalEvent[], color: string) => (
    list.length > 0 && (
      <div className={`border rounded-xl p-4 ${color}`}>
        <p className="font-bold text-gray-800 mb-2">{title}</p>
        <div className="space-y-1">
          {list.map(e => (
            <Link key={e.id} href={e.href} className="flex items-center gap-2 text-sm text-gray-700 hover:underline">
              <span className={`w-2 h-2 rounded-full ${KIND_STYLE[e.kind].dot}`} />
              <span>{e.label}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(e.date + 'T12:00:00').toLocaleDateString('es-US', { day: 'numeric', month: 'short' })}
              </span>
            </Link>
          ))}
        </div>
      </div>
    )
  )

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">📅 Calendario</h1>
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-2 py-1.5">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
            <span className="font-semibold text-gray-800 min-w-36 text-center">{MONTHS[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
          </div>
        </div>

        {loading ? <p className="text-gray-400 text-sm">Cargando…</p> : (
          <>
            {/* Alertas */}
            {alertBox('🔴 Atrasado', overdue, 'bg-red-50 border-red-200')}
            {alertBox('⭐ Hoy', today, 'bg-orange-50 border-orange-200')}
            {alertBox('📆 Esta semana', thisWeek, 'bg-white border-gray-200')}
            {overdue.length === 0 && today.length === 0 && thisWeek.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-gray-700">
                ✅ Nada pendiente hoy ni esta semana. Todo al día.
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
                  const evs = eventsOn(day)
                  const isToday = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === todayStr
                  return (
                    <div key={i} className={`min-h-20 rounded-lg border p-1.5 text-xs ${
                      isToday ? 'border-orange-400 bg-orange-50' : 'border-gray-100'
                    }`}>
                      <p className={`font-semibold mb-1 ${isToday ? 'text-orange-600' : 'text-gray-600'}`}>{day}</p>
                      {evs.slice(0, 3).map(e => (
                        <Link key={e.id} href={e.href}
                          className="flex items-center gap-1 truncate text-gray-600 hover:text-gray-900" title={e.label}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${KIND_STYLE[e.kind].dot}`} />
                          <span className="truncate">{e.label}</span>
                        </Link>
                      ))}
                      {evs.length > 3 && <p className="text-gray-400">+{evs.length - 3} más</p>}
                    </div>
                  )
                })}
              </div>

              {/* Leyenda */}
              <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-gray-100">
                {(Object.keys(KIND_STYLE) as EventKind[]).map(k => (
                  <span key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${KIND_STYLE[k].dot}`} />{KIND_STYLE[k].label}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
