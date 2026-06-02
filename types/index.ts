// Re-export all types for backward compatibility
export type { QuoteLineItem, PricingRule } from '@/lib/quote-engine'

// Legacy types used across the app
export interface Client {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type ServiceType = string
export type VehicleType = string
export type Complexity = 'simple' | 'medium' | 'complex'
export type Material = '3M' | 'Avery' | 'GF'

// Legacy QuoteItem (keep for backward compat)
export interface QuoteItem {
  service_type: string
  vehicle_type: string
  size_category: string
  complexity: string
  material: string
  description: string
  quantity: number
  unit_price: number
  sq_ft?: number
  subtotal: number
  discount_pct?: number
}
