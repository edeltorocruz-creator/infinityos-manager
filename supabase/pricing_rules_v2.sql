
-- ============================================================
-- INFINITY WRAP DESIGN — Quote Engine v2
-- Pricing Rules Table (editable from admin panel)
-- ============================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,           -- 'vehicle' | 'flat_surface' | 'service_fee'
  service_type TEXT NOT NULL,       -- 'truck', 'trailer', 'wall_mural', 'design_fee', etc.
  label TEXT NOT NULL,              -- Display name
  
  -- Pricing fields
  price_per_sqft NUMERIC(8,4),     -- Used for L-based and flat surface services
  base_price NUMERIC(10,2),        -- Flat fee (design, removal, rush, etc.)
  min_price NUMERIC(10,2),         -- Minimum project price
  
  -- Material & labor breakdown (for transparency in quote)
  material_rate NUMERIC(8,4),      -- material cost per sqft
  labor_rate NUMERIC(8,4),         -- labor cost per sqft
  
  -- Formula fields (for L-based vehicle calculations)
  formula TEXT,                    -- 'L_based' | 'flat_sqft' | 'flat_fee' | 'manual'
  sqft_multiplier_side NUMERIC(6,4) DEFAULT 8,   -- width of vehicle side in ft
  sqft_multiplier_top  NUMERIC(6,4) DEFAULT 8,   -- roof section in ft
  extra_rate NUMERIC(8,4),         -- extra per sqft (truck=4, trailer=2.93)
  
  -- Metadata
  is_default BOOLEAN DEFAULT true, -- true = market estimate, false = your real price
  active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='pricing_rules' AND policyname='allow_all_pricing') THEN
    CREATE POLICY allow_all_pricing ON pricing_rules FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
-- SEED DATA — Infinity Wrap Design Pricing
-- Marked as is_default=true (editable from admin)
-- ============================================================

INSERT INTO pricing_rules (category, service_type, label, formula, price_per_sqft, min_price, material_rate, labor_rate, extra_rate, sqft_multiplier_side, sqft_multiplier_top, notes, is_default) VALUES

-- VEHICLE WRAPS (L-based formula: SqFt = (L*side)*2 + (top*top)*2)
('vehicle', 'truck',      'Truck Full Wrap',       'L_based',    8.50, 2800, 3.50, 5.00, 4.00,  8, 8, 'Your real price. subtotal=base+(sqft*4)', false),
('vehicle', 'trailer',    'Trailer Full Wrap',     'L_based',    8.50, 3500, 3.50, 5.00, 2.93,  8, 8, 'Your real price. subtotal=base+(sqft*2.93)', false),
('vehicle', 'food_truck', 'Food Truck Wrap',       'L_based',    9.00, 3200, 3.75, 5.25, 3.50,  8, 8, 'NC market avg ~$3,500-$5,500. Slightly below.', true),
('vehicle', 'van',        'Van / Sprinter Wrap',   'L_based',    8.75, 2600, 3.50, 5.25, 3.75,  7, 7, 'NC market avg ~$2,800-$4,500. Slightly below.', true),
('vehicle', 'car',        'Car Full Wrap',         'L_based',    9.50, 1800, 3.75, 5.75, 3.00,  6, 6, 'NC market avg ~$2,000-$3,500. Slightly below.', true),
('vehicle', 'suv',        'SUV Full Wrap',         'L_based',    9.25, 2200, 3.75, 5.50, 3.25,  7, 7, 'NC market avg ~$2,400-$4,000. Slightly below.', true),
('vehicle', 'pickup',     'Pickup Full Wrap',      'L_based',    9.00, 2000, 3.50, 5.50, 3.50,  7, 7, 'NC market avg ~$2,200-$3,800. Slightly below.', true),

-- FLAT SURFACE SERVICES (price per sqft, manual sqft entry)
('flat_surface', 'partial_wrap',   'Partial Wrap',            'flat_sqft', 7.50, 800,  3.00, 4.50, null, null, null, 'NC market $6-$10/sqft. Competitive at $7.50.', true),
('flat_surface', 'lettering',      'Lettering & Decals',      'flat_sqft', 6.00, 350,  2.50, 3.50, null, null, null, 'NC market $5-$8/sqft. Competitive at $6.', true),
('flat_surface', 'window_graphics','Window Graphics',         'flat_sqft', 8.00, 400,  3.50, 4.50, null, null, null, 'NC market $7-$12/sqft. Competitive at $8.', true),
('flat_surface', 'perforated_vinyl','Perforated Window Vinyl','flat_sqft', 9.50, 450,  4.00, 5.50, null, null, null, 'NC market $8-$14/sqft. Competitive at $9.50.', true),
('flat_surface', 'wall_mural',     'Wall Mural',              'flat_sqft', 10.00, 600, 4.00, 6.00, null, null, null, 'NC market $8-$15/sqft. Competitive at $10.', true),
('flat_surface', 'storefront',     'Storefront Graphics',     'flat_sqft', 9.00, 500,  3.75, 5.25, null, null, null, 'NC market $7-$13/sqft. Competitive at $9.', true),
('flat_surface', 'signs_banners',  'Signs & Banners',         'flat_sqft', 5.00, 250,  2.00, 3.00, null, null, null, 'NC market $4-$8/sqft. Competitive at $5.', true),

-- SERVICE FEES (flat fee)
('service_fee', 'design_fee',    'Design Fee',       'flat_fee', null, 150,  null, null, null, null, null, 'Per design project. Waived on orders over $2,000.', true),
('service_fee', 'installation',  'Installation Fee', 'flat_fee', null, 200,  null, null, null, null, null, 'Standalone installation. Included in wrap prices.', true),
('service_fee', 'removal',       'Removal Fee',      'flat_fee', null, 300,  null, null, null, null, null, 'Full vehicle wrap removal. Per vehicle.', true),
('service_fee', 'rush_fee',      'Rush Fee',         'flat_fee', null, 250,  null, null, null, null, null, '48-72hr turnaround premium.', true)

ON CONFLICT DO NOTHING;

SELECT category, service_type, label, price_per_sqft, min_price, is_default FROM pricing_rules ORDER BY category, service_type;
