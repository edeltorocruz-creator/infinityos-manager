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

// ─── PRICE MODES ──────────────────────────────────────────────────────────────
// auto:   formula from vehicle length (current behavior)
// sqft:   Eduardo enters exact sqft → formula prices those sqft with the rates
// manual: Eduardo enters the final price directly (no formula)
export type PriceMode = 'auto' | 'sqft' | 'manual'

// ─── PROJECT TYPES ────────────────────────────────────────────────────────────
export type ProjectType =
  | 'sedan' | 'van' | 'truck' | 'trailer' | 'food_truck'
  | 'mural' | 'window' | 'signage'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  sedan:      'Sedán',
  van:        'Van',
  truck:      'Truck',
  trailer:    'Trailer',
  food_truck: 'Food Truck',
  mural:      'Mural',
  window:     'Window',
  signage:    'Signage',
}

export const PROJECT_TYPE_EMOJI: Record<ProjectType, string> = {
  sedan: '🚗', van: '🚐', truck: '🚚', trailer: '🚛',
  food_truck: '🍔', mural: '🎨', window: '🪟', signage: '🪧',
}

// Types where the auto length-formula applies — ONLY truck & trailer (the original formula)
export const AUTO_TYPES: ProjectType[] = ['truck', 'trailer']

// Per-sqft extra — STRICTLY Eduardo's formula: truck +4, trailer +2.93, nothing else
export function extraRate(t: ProjectType): number {
  if (t === 'truck') return TRUCK_EXTRA
  if (t === 'trailer') return TRAILER_EXTRA
  return 0
}

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

// ─── LINE TYPE (v2 — supports 3 price modes + project types) ─────────────────
export interface SimpleLine {
  id: string
  mode: PriceMode
  projectType: ProjectType
  job: JobKind
  L: number               // vehicle length (auto mode)
  manualSqft: number      // sqft entered by hand (sqft mode)
  manualPrice: number     // final price entered by hand (manual mode)
  description: string
  sqft: number            // resolved sqft
  subtotal: number        // resolved price
}

// Resolves sqft + subtotal for a line according to its mode
export function calcLineV2(l: SimpleLine): { sqft: number; subtotal: number } {
  const rate = l.job === 'wrap' ? WRAP_RATE : STICKER_RATE

  if (l.mode === 'manual') {
    const price = l.manualPrice > 0 ? Math.round(l.manualPrice * 100) / 100 : 0
    return { sqft: l.manualSqft > 0 ? l.manualSqft : 0, subtotal: price }
  }

  if (l.mode === 'sqft') {
    if (!l.manualSqft || l.manualSqft <= 0) return { sqft: 0, subtotal: 0 }
    const sqft = Math.round(l.manualSqft * 100) / 100
    const subtotal = Math.round(sqft * (rate + extraRate(l.projectType)) * 100) / 100
    return { sqft, subtotal }
  }

  // auto — Eduardo's original length formula
  if (!l.L || l.L <= 0) return { sqft: 0, subtotal: 0 }
  const sqft = calcSqFt(l.L)
  const subtotal = Math.round(sqft * (rate + extraRate(l.projectType)) * 100) / 100
  return { sqft, subtotal }
}

// ─── DISCOUNT ─────────────────────────────────────────────────────────────────
export type DiscountType = 'none' | 'percent' | 'amount'

export interface Discount {
  type: DiscountType
  value: number
}

export function calcDiscountAmount(subtotal: number, d: Discount): number {
  if (!d || d.type === 'none' || !d.value || d.value <= 0) return 0
  const amt = d.type === 'percent' ? subtotal * (d.value / 100) : d.value
  return Math.min(Math.round(amt * 100) / 100, subtotal)
}

// ─── TOTALS ───────────────────────────────────────────────────────────────────
export function calcTotals(
  lines: { subtotal: number }[],
  discount: Discount = { type: 'none', value: 0 },
) {
  const subtotal = Math.round(lines.reduce((s, l) => s + l.subtotal, 0) * 100) / 100
  const discountAmount = calcDiscountAmount(subtotal, discount)
  const taxable  = Math.round((subtotal - discountAmount) * 100) / 100
  const tax      = Math.round(taxable * TAX_RATE * 100) / 100
  const total    = Math.round((taxable + tax) * 100) / 100
  const deposit  = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance  = Math.round((total - deposit) * 100) / 100
  return { subtotal, discountAmount, taxable, tax, total, deposit, balance }
}

// ─── PRICE JUSTIFICATION — concepts included (NO amounts, client-facing) ─────
export const INCLUDED_CONCEPTS: string[] = [
  'Custom design & digital mockup (proof before printing)',
  'Premium cast vinyl with protective laminate',
  'High-resolution large-format printing',
  'Surface preparation & decontamination',
  'Professional installation by certified installers',
  'Installation workmanship warranty',
]

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
