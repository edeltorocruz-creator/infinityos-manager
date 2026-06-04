// ============================================================
// BUSINESS CONFIG — multi-business foundation
// Each business type has its own services, labels, and defaults
// Adding a new business = add an entry here + seed pricing_rules
// ============================================================

export type BusinessType = 'wrap' | 'cleaning' | 'remodeling' | 'landscaping' | 'general'

export interface ServiceDef {
  id: string
  label: string
  unit: 'sqft' | 'flat' | 'hourly' | 'item'
  defaultPrice: number
  category: string
}

export interface BusinessConfig {
  type: BusinessType
  name: string
  icon: string
  quoteTerms: string
  warrantyText: string
  services: ServiceDef[]
}

// ── INFINITY WRAP (default / current) ──
const WRAP_CONFIG: BusinessConfig = {
  type: 'wrap',
  name: 'Infinity Wrap Design',
  icon: '∞',
  quoteTerms: `PAYMENT: 50% deposit to schedule. Balance due on completion.\nDESIGN: Approval required before printing.\nCANCELLATION: Deposits non-refundable once materials ordered.\nVEHICLE: Must be clean and in good condition prior to install.`,
  warrantyText: '1-year workmanship warranty. Material manufacturer warranty applies.',
  services: [
    { id: 'full_wrap',       label: 'Full Vehicle Wrap',    unit: 'sqft',  defaultPrice: 12.50, category: 'Vehicle' },
    { id: 'partial_wrap',    label: 'Partial Wrap',         unit: 'sqft',  defaultPrice: 10.00, category: 'Vehicle' },
    { id: 'food_truck',      label: 'Food Truck Wrap',      unit: 'sqft',  defaultPrice: 13.00, category: 'Vehicle' },
    { id: 'fleet',           label: 'Fleet Graphics',       unit: 'sqft',  defaultPrice: 9.50,  category: 'Vehicle' },
    { id: 'window_graphics', label: 'Window Graphics',      unit: 'sqft',  defaultPrice: 8.00,  category: 'Graphics' },
    { id: 'wall_mural',      label: 'Wall Mural',           unit: 'sqft',  defaultPrice: 7.50,  category: 'Graphics' },
    { id: 'signage',         label: 'Signage / Banners',    unit: 'sqft',  defaultPrice: 6.00,  category: 'Graphics' },
    { id: 'lettering',       label: 'Lettering / Decals',   unit: 'sqft',  defaultPrice: 5.00,  category: 'Graphics' },
    { id: 'design_fee',      label: 'Design Fee',           unit: 'flat',  defaultPrice: 150,   category: 'Services' },
    { id: 'installation',    label: 'Installation',         unit: 'flat',  defaultPrice: 200,   category: 'Services' },
    { id: 'removal',         label: 'Removal',              unit: 'flat',  defaultPrice: 125,   category: 'Services' },
    { id: 'rush_fee',        label: 'Rush Fee',             unit: 'flat',  defaultPrice: 100,   category: 'Services' },
  ]
}

const CLEANING_CONFIG: BusinessConfig = {
  type: 'cleaning',
  name: 'Elite Cleaning Services',
  icon: '✦',
  quoteTerms: `PAYMENT: Due upon service completion.\nCANCELLATION: 24-hour notice required.\nACCESS: Customer must provide access to property at scheduled time.`,
  warrantyText: 'Satisfaction guaranteed. We will return to address any missed areas.',
  services: [
    { id: 'residential',    label: 'Residential Clean',    unit: 'flat',   defaultPrice: 150,  category: 'Residential' },
    { id: 'deep_clean',     label: 'Deep Clean',           unit: 'flat',   defaultPrice: 280,  category: 'Residential' },
    { id: 'move_in_out',    label: 'Move In/Out Clean',    unit: 'flat',   defaultPrice: 350,  category: 'Residential' },
    { id: 'commercial',     label: 'Commercial Clean',     unit: 'sqft',   defaultPrice: 0.18, category: 'Commercial' },
    { id: 'post_construct', label: 'Post-Construction',    unit: 'sqft',   defaultPrice: 0.35, category: 'Commercial' },
    { id: 'carpet',         label: 'Carpet Cleaning',      unit: 'sqft',   defaultPrice: 0.40, category: 'Specialty' },
    { id: 'window_wash',    label: 'Window Washing',       unit: 'item',   defaultPrice: 8,    category: 'Specialty' },
    { id: 'pressure_wash',  label: 'Pressure Washing',     unit: 'flat',   defaultPrice: 200,  category: 'Specialty' },
  ]
}

const REMODELING_CONFIG: BusinessConfig = {
  type: 'remodeling',
  name: 'Remodeling Services',
  icon: '⚒',
  quoteTerms: `PAYMENT: 30% deposit. Progress payments per milestone. Balance on completion.\nPERMITS: Customer responsible for permits unless otherwise agreed.\nCHANGES: Change orders must be signed before work proceeds.`,
  warrantyText: '1-year workmanship warranty on all labor.',
  services: [
    { id: 'kitchen',      label: 'Kitchen Remodel',    unit: 'flat',   defaultPrice: 5000,  category: 'Interior' },
    { id: 'bathroom',     label: 'Bathroom Remodel',   unit: 'flat',   defaultPrice: 3000,  category: 'Interior' },
    { id: 'flooring',     label: 'Flooring',           unit: 'sqft',   defaultPrice: 4.50,  category: 'Interior' },
    { id: 'painting_int', label: 'Interior Painting',  unit: 'sqft',   defaultPrice: 2.50,  category: 'Interior' },
    { id: 'painting_ext', label: 'Exterior Painting',  unit: 'sqft',   defaultPrice: 3.00,  category: 'Exterior' },
    { id: 'deck',         label: 'Deck / Patio',       unit: 'sqft',   defaultPrice: 35,    category: 'Exterior' },
    { id: 'demo',         label: 'Demolition',         unit: 'flat',   defaultPrice: 500,   category: 'Services' },
    { id: 'labor',        label: 'Labor (hourly)',      unit: 'hourly', defaultPrice: 65,    category: 'Services' },
  ]
}

const LANDSCAPING_CONFIG: BusinessConfig = {
  type: 'landscaping',
  name: 'Landscaping Services',
  icon: '🌿',
  quoteTerms: `PAYMENT: Due upon completion of each service.\nWEATHER: Rescheduled at no charge due to weather.\nACCESS: Gate/property access required on service day.`,
  warrantyText: 'Plants guaranteed 30 days. Workmanship guaranteed 1 year.',
  services: [
    { id: 'mowing',       label: 'Lawn Mowing',        unit: 'flat',   defaultPrice: 60,    category: 'Lawn' },
    { id: 'trimming',     label: 'Trimming & Edging',  unit: 'flat',   defaultPrice: 45,    category: 'Lawn' },
    { id: 'cleanup',      label: 'Yard Cleanup',       unit: 'flat',   defaultPrice: 150,   category: 'Lawn' },
    { id: 'mulching',     label: 'Mulching',           unit: 'sqft',   defaultPrice: 0.75,  category: 'Beds' },
    { id: 'planting',     label: 'Planting',           unit: 'item',   defaultPrice: 25,    category: 'Beds' },
    { id: 'irrigation',   label: 'Irrigation',         unit: 'flat',   defaultPrice: 800,   category: 'Systems' },
    { id: 'tree_trim',    label: 'Tree Trimming',      unit: 'item',   defaultPrice: 150,   category: 'Trees' },
    { id: 'tree_remove',  label: 'Tree Removal',       unit: 'item',   defaultPrice: 400,   category: 'Trees' },
  ]
}

export const BUSINESS_CONFIGS: Record<BusinessType, BusinessConfig> = {
  wrap:        WRAP_CONFIG,
  cleaning:    CLEANING_CONFIG,
  remodeling:  REMODELING_CONFIG,
  landscaping: LANDSCAPING_CONFIG,
  general:     { ...WRAP_CONFIG, type: 'general', name: 'My Business' },
}

// Active config — reads from localStorage if set, defaults to wrap
export function getActiveConfig(): BusinessConfig {
  if (typeof window === 'undefined') return WRAP_CONFIG
  const saved = localStorage.getItem('business_type') as BusinessType | null
  return BUSINESS_CONFIGS[saved || 'wrap'] || WRAP_CONFIG
}

export function setActiveBusinessType(type: BusinessType) {
  localStorage.setItem('business_type', type)
}
