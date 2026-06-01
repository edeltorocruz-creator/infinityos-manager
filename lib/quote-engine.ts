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
  simple: 'Simple — Solid colors, basic design',
  medium: 'Medium — Moderate graphics, custom elements',
  complex: 'Complex — Full custom artwork, intricate design',
}

export const FLAT_SURFACE_SERVICES = [
  'wall_mural', 'window_graphics', 'storefront_graphics', 'interior_graphics'
]

export const VEHICLE_SERVICES = [
  'full_wrap', 'partial_wrap', 'lettering', 'fleet_graphics'
]

// ============================================================
// COMPETITIVE PRICING — NC Market (researched vs competitors)
// Sources: Wrap Guys, Car Wraps Charlotte, Raleigh Wraps, WrapIQ
// Strategy: 8-12% below market average to win jobs
// ============================================================
export const FALLBACK_PRICING: Record<string, Record<string, Record<string, Record<string, number>>>> = {
  full_wrap: {
    car:        { simple: { '3M': 1850, Avery: 1750, GF: 1600 }, medium: { '3M': 2400, Avery: 2250, GF: 2050 }, complex: { '3M': 3200, Avery: 3000, GF: 2750 } },
    suv:        { simple: { '3M': 2200, Avery: 2050, GF: 1900 }, medium: { '3M': 2900, Avery: 2700, GF: 2450 }, complex: { '3M': 3800, Avery: 3550, GF: 3250 } },
    truck:      { simple: { '3M': 2400, Avery: 2250, GF: 2050 }, medium: { '3M': 3100, Avery: 2900, GF: 2650 }, complex: { '3M': 4100, Avery: 3800, GF: 3500 } },
    van:        { simple: { '3M': 2800, Avery: 2600, GF: 2400 }, medium: { '3M': 3600, Avery: 3350, GF: 3050 }, complex: { '3M': 4800, Avery: 4450, GF: 4100 } },
    trailer:    { simple: { '3M': 3500, Avery: 3250, GF: 3000 }, medium: { '3M': 4800, Avery: 4450, GF: 4100 }, complex: { '3M': 6500, Avery: 6000, GF: 5500 } },
    food_truck: { simple: { '3M': 3200, Avery: 2950, GF: 2700 }, medium: { '3M': 4200, Avery: 3900, GF: 3550 }, complex: { '3M': 5800, Avery: 5400, GF: 4950 } },
  },
  partial_wrap: {
    car:        { simple: { '3M': 850,  Avery: 800,  GF: 730  }, medium: { '3M': 1200, Avery: 1100, GF: 1000 }, complex: { '3M': 1700, Avery: 1600, GF: 1450 } },
    suv:        { simple: { '3M': 1000, Avery: 950,  GF: 850  }, medium: { '3M': 1450, Avery: 1350, GF: 1250 }, complex: { '3M': 2000, Avery: 1850, GF: 1700 } },
    truck:      { simple: { '3M': 1100, Avery: 1000, GF: 920  }, medium: { '3M': 1550, Avery: 1450, GF: 1300 }, complex: { '3M': 2200, Avery: 2050, GF: 1850 } },
    van:        { simple: { '3M': 1300, Avery: 1200, GF: 1100 }, medium: { '3M': 1800, Avery: 1680, GF: 1550 }, complex: { '3M': 2500, Avery: 2350, GF: 2150 } },
    trailer:    { simple: { '3M': 1800, Avery: 1680, GF: 1550 }, medium: { '3M': 2500, Avery: 2350, GF: 2150 }, complex: { '3M': 3500, Avery: 3250, GF: 3000 } },
    food_truck: { simple: { '3M': 1500, Avery: 1400, GF: 1280 }, medium: { '3M': 2200, Avery: 2050, GF: 1850 }, complex: { '3M': 3000, Avery: 2800, GF: 2550 } },
  },
  lettering: {
    car:        { simple: { '3M': 280,  Avery: 260,  GF: 240  }, medium: { '3M': 480,  Avery: 450,  GF: 410  }, complex: { '3M': 750,  Avery: 700,  GF: 640  } },
    suv:        { simple: { '3M': 320,  Avery: 300,  GF: 275  }, medium: { '3M': 520,  Avery: 490,  GF: 450  }, complex: { '3M': 820,  Avery: 770,  GF: 700  } },
    truck:      { simple: { '3M': 350,  Avery: 325,  GF: 300  }, medium: { '3M': 580,  Avery: 540,  GF: 500  }, complex: { '3M': 900,  Avery: 840,  GF: 770  } },
    van:        { simple: { '3M': 420,  Avery: 390,  GF: 360  }, medium: { '3M': 680,  Avery: 640,  GF: 580  }, complex: { '3M': 1050, Avery: 980,  GF: 900  } },
    trailer:    { simple: { '3M': 580,  Avery: 540,  GF: 500  }, medium: { '3M': 950,  Avery: 880,  GF: 810  }, complex: { '3M': 1500, Avery: 1400, GF: 1280 } },
    food_truck: { simple: { '3M': 500,  Avery: 465,  GF: 425  }, medium: { '3M': 820,  Avery: 770,  GF: 700  }, complex: { '3M': 1300, Avery: 1200, GF: 1100 } },
  },
  fleet_graphics: {
    car:        { simple: { '3M': 750,  Avery: 700,  GF: 640  }, medium: { '3M': 1100, Avery: 1020, GF: 940  }, complex: { '3M': 1600, Avery: 1500, GF: 1370 } },
    suv:        { simple: { '3M': 900,  Avery: 840,  GF: 770  }, medium: { '3M': 1300, Avery: 1220, GF: 1120 }, complex: { '3M': 1900, Avery: 1780, GF: 1630 } },
    truck:      { simple: { '3M': 980,  Avery: 920,  GF: 840  }, medium: { '3M': 1450, Avery: 1360, GF: 1240 }, complex: { '3M': 2100, Avery: 1960, GF: 1800 } },
    van:        { simple: { '3M': 1150, Avery: 1080, GF: 980  }, medium: { '3M': 1700, Avery: 1580, GF: 1450 }, complex: { '3M': 2450, Avery: 2290, GF: 2100 } },
    trailer:    { simple: { '3M': 1500, Avery: 1400, GF: 1280 }, medium: { '3M': 2200, Avery: 2050, GF: 1880 }, complex: { '3M': 3200, Avery: 2990, GF: 2740 } },
    food_truck: { simple: { '3M': 1300, Avery: 1220, GF: 1120 }, medium: { '3M': 1900, Avery: 1780, GF: 1630 }, complex: { '3M': 2800, Avery: 2610, GF: 2400 } },
  },
  wall_mural: {
    any: { simple: { '3M': 8, Avery: 7.5, GF: 6.8 }, medium: { '3M': 12, Avery: 11, GF: 10 }, complex: { '3M': 18, Avery: 16.5, GF: 15 } },
  },
  window_graphics: {
    any: { simple: { '3M': 9, Avery: 8.5, GF: 7.8 }, medium: { '3M': 13, Avery: 12, GF: 11 }, complex: { '3M': 19, Avery: 17.5, GF: 16 } },
  },
  storefront_graphics: {
    any: { simple: { '3M': 10, Avery: 9, GF: 8.2 }, medium: { '3M': 14, Avery: 13, GF: 12 }, complex: { '3M': 20, Avery: 18.5, GF: 17 } },
  },
  interior_graphics: {
    any: { simple: { '3M': 7, Avery: 6.5, GF: 6 }, medium: { '3M': 11, Avery: 10, GF: 9 }, complex: { '3M': 16, Avery: 15, GF: 13.5 } },
  },
}

export async function getPricingRule(
  service_type: ServiceType,
  vehicle_type: VehicleType,
  complexity: Complexity,
  material: Material
): Promise<PricingRule | null> {
  try {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('service_type', service_type)
      .in('vehicle_type', [vehicle_type, 'any'])
      .eq('complexity', complexity)
      .eq('material', material)
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (!error && data) return data as PricingRule
  } catch (e) {
    // fall through to fallback
  }
  return null
}

export function getFallbackPrice(
  service_type: string,
  vehicle_type: string,
  complexity: string,
  material: string
): number {
  const svc = FALLBACK_PRICING[service_type]
  if (!svc) return 0
  const veh = svc[vehicle_type] || svc['any']
  if (!veh) return 0
  const cmp = veh[complexity]
  if (!cmp) return 0
  return cmp[material] || 0
}

export function isSqFtService(service_type: string): boolean {
  return FLAT_SURFACE_SERVICES.includes(service_type)
}

export function calculateItemPrice(
  rule: PricingRule | null,
  quantity: number,
  sq_ft?: number,
  manual_price?: number,
  service_type?: string,
  vehicle_type?: string,
  complexity?: string,
  material?: string
): { unit_price: number; subtotal: number; discount_pct: number } {
  let unit_price = manual_price ?? 0
  let discount_pct = 0

  if (!manual_price) {
    if (rule) {
      if (rule.calculation_type === 'fixed') {
        unit_price = rule.base_price ?? 0
      } else if (rule.calculation_type === 'sqft' && sq_ft) {
        unit_price = (rule.sq_ft_price ?? 0) * sq_ft
        if (rule.min_price && unit_price < rule.min_price) unit_price = rule.min_price
        if (rule.max_price && unit_price > rule.max_price) unit_price = rule.max_price
      }
    } else if (service_type && vehicle_type && complexity && material) {
      // Use fallback pricing table
      const fallback = getFallbackPrice(service_type, vehicle_type, complexity, material)
      if (sq_ft && isSqFtService(service_type)) {
        unit_price = fallback * sq_ft
      } else {
        unit_price = fallback
      }
    }
  }

  // Fleet volume discount
  const svc = service_type || rule?.service_type || ''
  if (svc === 'fleet_graphics') {
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
