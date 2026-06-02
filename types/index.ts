// Re-export all types for backward compatibility
export type { QuoteLineItem, PricingRule } from '@/lib/quote-engine'

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

export interface Quote {
  id: string
  client_id?: string | null
  quote_number: string
  items: any[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: 'draft' | 'sent' | 'approved' | 'rejected'
  valid_days: number
  notes?: string | null
  sent_at?: string | null
  expires_at?: string | null
  accepted_at?: string | null
  created_at?: string
  updated_at?: string
  client?: Client
}

export type ServiceType = string
export type VehicleType = string
export type Complexity = 'simple' | 'medium' | 'complex'
export type Material = '3M' | 'Avery' | 'GF'

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
