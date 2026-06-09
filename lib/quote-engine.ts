import { supabase } from './supabase'

export const TAX_RATE     = 0.0675   // NC 6.75%
export const DEPOSIT_RATE = 0.50
export const VALID_DAYS   = 30
export const FIXED_HEIGHT = 7.7      // ft — standard height for trailers/food trucks

// ─── SQ FT FORMULA ────────────────────────────────────────────────────────────
// For trailers, food trucks, flat surfaces:
// Both sides: (L × H) × 2
// Front + back: (H × H) × 2
export function calcSqFt(L: number, H: number = FIXED_HEIGHT): number {
  return Math.round(((L * H) * 2 + (H * H) * 2) * 100) / 100
}

// Flat surface (murals, windows, signs): W × H
export function calcFlatSqFt(W: number, H: number): number {
  return Math.round(W * H * 100) / 100
}

// ─── PRICING MULTIPLIERS ──────────────────────────────────────────────────────
export const MATERIAL_MULTIPLIERS: Record<string, number> = {
  gf:      1.0,
  avery:   1.10,
  '3m':    1.20,
  premium: 1.35,
}

export const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  simple:  1.0,
  medium:  1.20,
  complex: 1.45,
}

export const MATERIAL_LABELS: Record<string, string> = {
  gf:      'General Formulations',
  avery:   'Avery Dennison',
  '3m':    '3M Series',
  premium: 'Premium / Specialty',
}

export const COMPLEXITY_LABELS: Record<string, string> = {
  simple:  'Simple — flat surfaces, no obstacles',
  medium:  'Medium — curves, mild obstructions',
  complex: 'Complex — rivets, recesses, heavy cuts',
}

// ─── VEHICLE BASE PRICES ──────────────────────────────────────────────────────
export const VEHICLE_BASE_PRICES: Record<string, Record<string, number>> = {
  sedan:     { full: 2800, partial: 900,  decals: 350 },
  suv:       { full: 3500, partial: 1200, decals: 400 },
  truck:     { full: 3800, partial: 1300, decals: 450 },
  van:       { full: 4500, partial: 1500, decals: 500 },
  box_truck: { full: 5500, partial: 2000, decals: 600 },
  trailer:   { full: 4800, partial: 1800, decals: 550 },
  food_truck:{ full: 5000, partial: 1900, decals: 580 },
}

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan:     'Sedan / Coupe',
  suv:       'SUV / Crossover',
  truck:     'Truck (Crew/Regular)',
  van:       'Van / Sprinter',
  box_truck: 'Box Truck',
  trailer:   'Trailer',
  food_truck:'Food Truck',
}

export const WRAP_TYPE_LABELS: Record<string, string> = {
  full:    'Full Wrap',
  partial: 'Partial Wrap',
  decals:  'Decals / Lettering',
}

// ─── INCLUDES TEXT (shown on quote — no prices) ───────────────────────────────
export function getIncludesText(options: {
  isPrinted: boolean
  hasDesign: boolean
  hasLamination: boolean
  hasChromeDelete: boolean
  hasColorChange: boolean
}): string {
  const items: string[] = ['vinyl material', 'professional installation']
  if (options.isPrinted)      items.push('full-color printing')
  if (options.hasLamination)  items.push('protective lamination')
  if (options.hasDesign)      items.push('custom graphic design')
  if (options.hasChromeDelete) items.push('chrome delete')
  if (options.hasColorChange)  items.push('color change film')
  return 'Includes: ' + items.join(', ')
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

// ─── QUOTE NUMBER — sequential 001, 002, 003 ─────────────────────────────────
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

// ─── TERMS ───────────────────────────────────────────────────────────────────
export const WARRANTY_TEXT =
  '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7 years, Avery: 5 years, GF: 5 years).'

export const TERMS_TEXT =
  `PAYMENT TERMS: 50% deposit required to schedule. Remaining 50% due upon completion before delivery.
DESIGN: Design approval required before printing. Revisions after approval may incur additional fees.
CANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.
VEHICLE CONDITION: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.
CHANGES: Any scope changes must be approved in writing and may affect pricing and timeline.`

// ─── TYPES ───────────────────────────────────────────────────────────────────
export type MaterialType   = 'gf' | 'avery' | '3m' | 'premium'
export type ComplexityLevel = 'simple' | 'medium' | 'complex'
export type WrapType       = 'full' | 'partial' | 'decals'

export interface SqFtLine {
  id: string
  mode: 'L' | 'WH'           // L = trailer/food truck, WH = mural/window/sign
  label: string
  description: string
  // dimensions
  L?: number
  W?: number
  H?: number
  sqft: number
  // pricing (internal — not shown on quote)
  pricePerSqft: number
  material: MaterialType
  complexity: ComplexityLevel
  // options
  isPrinted: boolean
  hasDesign: boolean
  hasLamination: boolean
  subtotal: number
  // display
  includesText: string
}

export interface VehicleLine {
  id: string
  vehicleType: string
  wrapType: WrapType
  material: MaterialType
  complexity: ComplexityLevel
  colorChange: boolean
  printedWrap: boolean
  chromeDelete: boolean
  hasDesign: boolean
  subtotal: number
  notes: string
  includesText: string
}
