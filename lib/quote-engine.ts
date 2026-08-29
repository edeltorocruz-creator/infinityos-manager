import { supabase } from './supabase'
import { DiscountType, QuoteStatus } from '@/types'

// ─── BUSINESS CONSTANTS ───────────────────────────────────────────────────────
export const TAX_RATE     = 0.0675   // NC 6.75%
export const DEPOSIT_RATE = 0.50
export const VALID_DAYS   = 30
export const FIXED_HEIGHT = 7.7      // ft — fixed height used in the formula

// ─── THE FORMULA (Eduardo's real Excel formula) ───────────────────────────────
// SqFt = (L × H) × 2 + (H × H) × 2   (both sides + front & back), H fixed = 7.7
// Full Wrap:  base = SqFt × 8.5
// Sticker:    base = SqFt × 13.5
// Truck:      subtotal = base + SqFt × 4
// Trailer:    subtotal = base + SqFt × 2.93

export type VehicleKind = 'truck' | 'trailer'
export type JobKind     = 'wrap' | 'sticker'

export const WRAP_RATE     = 8.5
export const STICKER_RATE  = 13.5
export const TRUCK_EXTRA   = 4
export const TRAILER_EXTRA = 2.93

export const VEHICLE_LABELS: Record<VehicleKind, string> = {
  truck:   'Truck',
  trailer: 'Trailer',
}

export const JOB_LABELS: Record<JobKind, string> = {
  wrap:    'Full Wrap',
  sticker: 'Sticker / Lettering',
}

export function calcSqFt(L: number, H: number = FIXED_HEIGHT): number {
  return Math.round(((L * H) * 2 + (H * H) * 2) * 100) / 100
}

export function calcQuoteLine(vehicle: VehicleKind, job: JobKind, L: number) {
  if (!L || L <= 0) return { sqft: 0, subtotal: 0 }
  const sqft  = calcSqFt(L)
  const rate  = job === 'wrap' ? WRAP_RATE : STICKER_RATE
  const base  = sqft * rate
  const extra = vehicle === 'truck' ? sqft * TRUCK_EXTRA : sqft * TRAILER_EXTRA
  const subtotal = Math.round((base + extra) * 100) / 100
  return { sqft, subtotal }
}

// ─── ESTADOS — mismos valores exactos que el campo "Status" en Airtable ──────
export const STATUS_OPTIONS: QuoteStatus[] = ['Draft', 'Sent', 'Approved', 'Paid', 'Overdue', 'Cancelled']

export const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string }> = {
  Draft:     { label: 'Draft',     color: 'bg-gray-100 text-gray-700' },
  Sent:      { label: 'Sent',      color: 'bg-blue-100 text-blue-700' },
  Approved:  { label: 'Approved',  color: 'bg-purple-100 text-purple-700' },
  Paid:      { label: 'Paid',      color: 'bg-green-100 text-green-700' },
  Overdue:   { label: 'Overdue',   color: 'bg-red-100 text-red-700' },
  Cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-400' },
}

// Una cotización cuenta como "abierta para cobrar" si no está ya Paid ni Cancelled —
// mismo criterio usado en el Artifact para mostrar el botón "Marcar cobrada".
export function canMarkPaid(status: QuoteStatus): boolean {
  return status !== 'Paid' && status !== 'Cancelled'
}

// ─── DESCUENTO — mismos valores que "Discount Type" en Airtable (None/Percent/Amount) ─
export interface Discount {
  type: DiscountType
  value: number
}

export function calcDiscountAmount(subtotal: number, d?: Discount): number {
  if (!d || d.type === 'None' || !d.value || d.value <= 0) return 0
  const amt = d.type === 'Percent' ? subtotal * (d.value / 100) : d.value
  return Math.min(Math.round(amt * 100) / 100, subtotal)
}

// ─── PRICE JUSTIFICATION — concepts included (NO amounts, client-facing) ─────
export const INCLUDED_CONCEPTS: string[] = [
  'Custom design & digital mockup (proof before printing)',
  'Premium cast vinyl with protective laminate',
  'High-resolution large-format printing',
  'Surface preparation & decontamination',
  'Professional installation — labor & work time',
  'Installation workmanship warranty',
]

// ─── TOTALS ───────────────────────────────────────────────────────────────────
// Replica exacta de la fórmula ya probada en el Artifact:
//   Total = (Subtotal - Descuento) + Tax   donde Tax = (Subtotal - Descuento) × TAX_RATE
//   Final Total = Total (después de descuento) — este es el monto que cuenta como
//   ingreso una vez la cotización se marca Paid (menos el tax, que no es ingreso real).
export function calcTotals(
  lines: { subtotal: number }[],
  discount?: Discount,
) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100
  const discountAmount = calcDiscountAmount(subtotal, discount)
  const taxable  = Math.round((subtotal - discountAmount) * 100) / 100
  const tax      = Math.round(taxable * TAX_RATE * 100) / 100
  const total    = Math.round((taxable + tax) * 100) / 100
  const deposit  = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  return { subtotal, discountAmount, taxable, tax, total, finalTotal: total, deposit, balance }
}

// ─── DOC NUMBER — secuencial Q-0001, mismo formato que el Artifact/Airtable ──
export async function generateDocNumber(): Promise<string> {
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
  const next = ((count ?? 0) + 1).toString().padStart(4, '0')
  return `Q-${next}`
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0)
}

export function formatDate(d?: Date): string {
  return (d || new Date()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

// ─── TERMS ────────────────────────────────────────────────────────────────────
export const WARRANTY_TEXT =
  '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7 years, Avery: 5 years, GF: 5 years).'

export const TERMS_TEXT =
  `PAYMENT TERMS: 50% deposit required to schedule. Remaining 50% due upon completion before delivery.
DESIGN: Design approval required before printing. Revisions after approval may incur additional fees.
CANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.
VEHICLE CONDITION: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.
CHANGES: Any scope changes must be approved in writing and may affect pricing and timeline.`

// ─── LINE TYPE (calculadoras de referencia en el formulario) ─────────────────
export interface SimpleLine {
  id: string
  vehicle: VehicleKind
  job: JobKind
  L: number
  description: string
  sqft: number
  subtotal: number
}
