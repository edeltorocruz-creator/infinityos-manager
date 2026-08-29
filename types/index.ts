// Tipos alineados con el schema REAL y en vivo de Supabase (project_id: oazojpaydvwsyzjnnvdt).
// No confundir con supabase/schema.sql, que quedó desactualizado — ver notas del proyecto.
// Estos tipos reflejan exactamente el mismo modelo ya probado en producción en el Artifact
// (Airtable base appZkSxRM0L7TUtmI, tabla Quotes_Invoices) para que la lógica de negocio
// (Ganancias, Marcar cobrada, descuentos) se comporte igual en ambos lados.

export interface Client {
  id: string
  name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  industry?: string | null
  notes?: string | null
  status?: string | null
  created_at?: string
  updated_at?: string
}

// Mismos valores que el campo "Status" (singleSelect) en Airtable.
export type QuoteStatus = 'Draft' | 'Sent' | 'Approved' | 'Paid' | 'Overdue' | 'Cancelled'
export type DocType = 'Quote' | 'Invoice'
export type DiscountType = 'None' | 'Percent' | 'Amount'

export interface Quote {
  id: string
  doc_number: string
  doc_type: DocType
  client_id?: string | null
  project_desc?: string | null
  date_issued?: string | null
  due_date?: string | null
  status: QuoteStatus
  tax_rate: number
  deposit?: number | null
  notes?: string | null
  subtotal: number
  tax_amt: number
  total: number
  discount_type: DiscountType
  discount_value?: number | null
  discount_amount: number
  final_total: number
  paid_date?: string | null
  created_at?: string
  updated_at?: string
  client?: Client
  line_items?: LineItem[]
}

export interface LineItem {
  id: string
  quote_id: string
  description: string
  qty: number
  price: number
  sort_order: number
  created_at?: string
}

export interface Expense {
  id: string
  expense_date: string
  description?: string | null
  vendor?: string | null
  category: string
  amount: number
  payment_method?: string | null
  related_project?: string | null
  has_receipt?: boolean
  receipt_url?: string | null
  ocr_raw?: string | null
  ocr_confidence?: string | null
  notes?: string | null
  created_at?: string
}

export interface Appointment {
  id: string
  title: string
  start_time: string
  end_time: string
  location?: string | null
  notes?: string | null
  client_id?: string | null
  created_at?: string
}
