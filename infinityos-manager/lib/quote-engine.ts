import { supabase } from './supabase'
import { PricingRule, ServiceType, VehicleType, Complexity, Material, QuoteItem } from '@/types'

export const TAX_RATE = 0.0675 // North Carolina 6.75%
export const VALID_DAYS_DEFAULT = 30

export const SERVICE_LABELS: Record<string, string> = {
  full_wrap: 'Full Wrap',
  partial_wrap: 'Partial Wrap',
  lettering: 'Lettering / Stickers',
  fleet_graphics: 'Fleet Graphics',
  wall_mural: 'Wall Mural',
  window_graphics: 'Window Graphics',
  storefront_graphics: 'Storefront Graphics',
  interior_graphics: 'Interior Graphics',
}

export const VEHICLE_LABELS: Record<string, string> = {
  car: 'Car / Sedan',
  suv: 'SUV / Crossover',
  truck: 'Truck',
  van: 'Van / Sprinter',
  trailer: 'Trailer / Box Truck',
  food_truck: 'Food Truck',
  any: 'Any / Surface',
}

export const COMPLEXITY_LABELS: Record<string, string> = {
  simple: 'Simple — Design básico, colores sólidos',
  medium: 'Medium — Diseño moderado, gráficos',
  complex: 'Complex — Diseño elaborado, custom art',
}

export const FLAT_SURFACE_SERVICES = [
  'wall_mural', 'window_graphics', 'storefront_graphics', 'interior_graphics'
]

export const VEHICLE_SERVICES = [
  'full_wrap', 'partial_wrap', 'lettering', 'fleet_graphics'
]

export async function getPricingRule(
  service_type: ServiceType,
  vehicle_type: VehicleType,
  complexity: Complexity,
  material: Material
): Promise<PricingRule | null> {
  const { data, error } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('service_type', service_type)
    .in('vehicle_type', [vehicle_type, 'any'])
    .eq('complexity', complexity)
    .eq('material', material)
    .eq('active', true)
    .limit(1)
    .single()

  if (error || !data) return null
  return data as PricingRule
}

export function calculateItemPrice(
  rule: PricingRule,
  quantity: number,
  sq_ft?: number,
  manual_price?: number
): { unit_price: number; subtotal: number; discount_pct: number } {
  let unit_price = manual_price ?? 0
  let discount_pct = 0

  if (!manual_price) {
    if (rule.calculation_type === 'fixed') {
      unit_price = rule.base_price ?? 0
    } else if (rule.calculation_type === 'sqft' && sq_ft) {
      unit_price = (rule.sq_ft_price ?? 0) * sq_ft
      if (rule.min_price && unit_price < rule.min_price) unit_price = rule.min_price
      if (rule.max_price && unit_price > rule.max_price) unit_price = rule.max_price
    }
  }

  // Fleet discount by volume
  if (rule.service_type === 'fleet_graphics') {
    if (quantity >= 10) discount_pct = 15
    else if (quantity >= 5) discount_pct = 10
    else if (quantity >= 3) discount_pct = 5
  }

  const subtotal = unit_price * quantity * (1 - discount_pct / 100)
  return { unit_price, subtotal: Math.round(subtotal * 100) / 100, discount_pct }
}

export function calculateQuoteTotals(items: QuoteItem[]): {
  subtotal: number
  tax_amount: number
  total: number
} {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const tax_amount = Math.round(subtotal * TAX_RATE * 100) / 100
  const total = Math.round((subtotal + tax_amount) * 100) / 100
  return { subtotal: Math.round(subtotal * 100) / 100, tax_amount, total }
}

export function generateQuoteNumber(): string {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const random = Math.floor(Math.random() * 9000) + 1000
  return `IWD-${year}${month}-${random}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}
