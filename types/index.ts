export type ServiceType = 
  | 'full_wrap' | 'partial_wrap' | 'lettering' | 'fleet_graphics'
  | 'wall_mural' | 'window_graphics' | 'storefront_graphics' | 'interior_graphics'

export type VehicleType = 
  | 'car' | 'suv' | 'truck' | 'van' | 'trailer' | 'food_truck' | 'any'

export type Complexity = 'simple' | 'medium' | 'complex'
export type Material = '3M' | 'Avery' | 'GF'
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected'
export type CalculationType = 'fixed' | 'sqft'

export interface PricingRule {
  id: string
  service_type: ServiceType
  vehicle_type: VehicleType
  size_category: string
  complexity: Complexity
  material: Material
  calculation_type: CalculationType
  base_price: number | null
  sq_ft_price: number | null
  min_price: number | null
  max_price: number | null
  description: string
  active: boolean
}

export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
}

export interface QuoteItem {
  service_type: ServiceType
  vehicle_type: VehicleType
  size_category: string
  complexity: Complexity
  material: Material
  description: string
  quantity: number
  unit_price: number
  sq_ft?: number
  subtotal: number
  discount_pct: number
}

export interface Quote {
  id: string
  client_id: string
  project_id: string | null
  lead_id: string | null
  quote_number: string
  items: QuoteItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: QuoteStatus
  valid_days: number
  notes: string | null
  sent_at: string | null
  expires_at: string | null
  accepted_at: string | null
  created_at: string
  updated_at: string
  client?: Client
}
