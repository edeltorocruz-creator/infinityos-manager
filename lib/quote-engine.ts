import { supabase } from './supabase'

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
  const sqft  = calcSqFt(L)
  const rate  = job === 'wrap' ? WRAP_RATE : STICKER_RATE
  const base  = sqft * rate
  const extra = vehicle === 'truck' ? sqft * TRUCK_EXTRA : sqft * TRAILER_EXTRA
  const subtotal = Math.round((base + extra) * 100) / 100
  return { sqft, subtotal }
}

// ─── TOTALS ───────────────────────────────────────────────────────────────────
export function calcTotals(lines: { subtotal: number }[]) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100
  const tax      = Math.round(subtotal * TAX_RATE * 100) / 100
  const total    = Math.round((subtotal + tax) * 100) / 100
  const deposit  = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  return { subtotal, tax, total, deposit, balance }
}

// ─── QUOTE NUMBER — sequential IWD-001 ────────────────────────────────────────
export async function generateQuoteNumber(): Promise<string> {
  const { count } = await supabase
    .from('quotes')
    .select('*', { count: 'exact', head: true })
  const next = ((count ?? 0) + 1).toString().padStart(3, '0')
  return `IWD-${next}`
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
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

// ─── LINE TYPE ────────────────────────────────────────────────────────────────
export interface SimpleLine {
  id: string
  vehicle: VehicleKind
  job: JobKind
  L: number
  description: string
  sqft: number
  subtotal: number
}
