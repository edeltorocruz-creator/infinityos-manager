import { supabase } from './supabase'

export const TAX_RATE = 0.0675  // NC 6.75%
export const DEPOSIT_RATE = 0.50
export const VALID_DAYS = 30
export const WARRANTY_DAYS = 365

// ============================================================
// FORMULA: L-based vehicle wrap
// SqFt = (L * side) * 2 + (top * top) * 2
// ============================================================
export function calcVehicleSqFt(
  L: number,
  side: number = 8,
  top: number = 8
): number {
  return (L * side) * 2 + (top * top) * 2
}

export function calcVehicleSubtotal(
  sqft: number,
  price_per_sqft: number,
  extra_rate: number
): number {
  const base = sqft * price_per_sqft
  return Math.round((base + sqft * extra_rate) * 100) / 100
}

// ============================================================
// FORMULA: Flat surface (W x H -> sqft)
// ============================================================
export function calcFlatSurface(sqft: number, price_per_sqft: number): number {
  return Math.round(sqft * price_per_sqft * 100) / 100
}

// Complexity multipliers
export const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  simple:  1.0,
  medium:  1.20,
  complex: 1.45,
}

export const COMPLEXITY_LABELS: Record<string, string> = {
  simple:  'Simple — flat surfaces, no obstacles',
  medium:  'Medium — curves, mild obstructions',
  complex: 'Complex — rivets, recesses, heavy cuts',
}

// Material multipliers (applied on top of base price)
export const MATERIAL_MULTIPLIERS: Record<string, number> = {
  economy: 0.85,
  gf:      1.0,
  avery:   1.10,
  '3m':    1.20,
  premium: 1.35,
}

export const MATERIAL_LABELS: Record<string, string> = {
  economy: 'Economy vinyl',
  gf:      'General Formulations',
  avery:   'Avery Dennison',
  '3m':    '3M Series',
  premium: 'Premium / Specialty',
}

// ============================================================
// TOTALS
// ============================================================
export function calcTotals(items: QuoteLineItem[]) {
  const subtotal = Math.round(items.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
  const tax = Math.round(subtotal * TAX_RATE * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100
  const deposit = Math.round(total * DEPOSIT_RATE * 100) / 100
  const balance = Math.round((total - deposit) * 100) / 100
  return { subtotal, tax, total, deposit, balance }
}

// ============================================================
// LOAD PRICING RULES FROM DB
// ============================================================
export async function loadPricingRule(service_type: string) {
  const { data } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('service_type', service_type)
    .eq('active', true)
    .maybeSingle()
  return data
}

export async function loadAllPricingRules() {
  const { data } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('active', true)
    .order('category')
    .order('label')
  return data || []
}

// ============================================================
// TYPES
// ============================================================
export type ComplexityLevel = 'simple' | 'medium' | 'complex'
export type MaterialType = 'economy' | 'gf' | 'avery' | '3m' | 'premium'
export type InputMode = 'L' | 'WH' | 'sqft' | 'fee'

export interface QuoteLineItem {
  id: string
  service_type: string
  label: string
  description: string
  // dimensions
  L?: number
  W?: number
  H?: number
  sqft: number
  // pricing breakdown
  price_per_sqft: number
  extra_rate?: number
  material: MaterialType
  complexity: ComplexityLevel
  material_multiplier: number
  complexity_multiplier: number
  base_price: number        // before multipliers
  subtotal: number          // final
  // meta
  material_rate?: number
  labor_rate?: number
  notes?: string
}

export interface PricingRule {
  id: string
  category: string
  service_type: string
  label: string
  formula: string
  price_per_sqft: number | null
  base_price: number | null
  min_price: number | null
  material_rate: number | null
  labor_rate: number | null
  sqft_multiplier_side: number
  sqft_multiplier_top: number
  extra_rate: number | null
  is_default: boolean
  notes: string | null
}

// ============================================================
// UTILS
// ============================================================
export function generateQuoteNumber(): string {
  const d = new Date()
  const yy = d.getFullYear().toString().slice(-2)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(Math.random() * 9000) + 1000
  return `IWD-${yy}${mm}-${rand}`
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function formatDate(d?: Date): string {
  return (d || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Determine input mode based on service type
export function getInputMode(serviceType: string): InputMode {
  if (VEHICLE_SERVICES.includes(serviceType)) return 'L'
  if (WH_SERVICES.includes(serviceType)) return 'WH'
  if (FEE_SERVICES.includes(serviceType)) return 'fee'
  return 'sqft'
}

export const VEHICLE_SERVICES = ['truck','trailer','food_truck','van','car','suv','pickup']
export const FLAT_SERVICES = ['partial_wrap','lettering','window_graphics','perforated_vinyl','wall_mural','storefront','signs_banners']
// Services that use Width x Height input
export const WH_SERVICES = ['wall_mural','window_graphics','perforated_vinyl','signs_banners','lettering','storefront']
export const FEE_SERVICES = ['design_fee','installation','removal','rush_fee']

export const WARRANTY_TEXT = '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7 years, Avery: 5 years, GF: 5 years).'
export const TERMS_TEXT = `PAYMENT TERMS: 50% deposit required to schedule. Remaining 50% due upon completion before delivery.\nDESIGN: Design approval required before printing. Revisions after approval may incur additional fees.\nCANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.\nVEHICLE CONDITION: Customer is responsible for ensuring vehicle is clean and in good condition prior to wrap installation.\nCHANGES: Any scope changes must be approved in writing and may affect pricing and timeline.`

export const SERVICE_LABELS: Record<string, string> = {
  truck: 'Truck Full Wrap',
  trailer: 'Trailer Full Wrap',
  food_truck: 'Food Truck Wrap',
  van: 'Van / Sprinter Wrap',
  car: 'Car Full Wrap',
  suv: 'SUV Full Wrap',
  pickup: 'Pickup Full Wrap',
  partial_wrap: 'Partial Wrap',
  lettering: 'Lettering & Decals',
  window_graphics: 'Window Graphics',
  perforated_vinyl: 'Perforated Window Vinyl',
  wall_mural: 'Wall Mural',
  storefront: 'Storefront Graphics',
  signs_banners: 'Signs & Banners',
  design_fee: 'Design Fee',
  installation: 'Installation Fee',
  removal: 'Removal Fee',
  rush_fee: 'Rush Fee',
}

export const VEHICLE_LABELS: Record<string, string> = {
  truck: 'Truck',
  trailer: 'Trailer',
  food_truck: 'Food Truck',
  van: 'Van / Sprinter',
  car: 'Car / Sedan',
  suv: 'SUV',
  pickup: 'Pickup',
  any: 'Any Surface',
}
