-- Business Profiles table — replaces localStorage business_type
-- Each profile is a named business configuration
CREATE TABLE IF NOT EXISTS business_profiles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  type         TEXT NOT NULL DEFAULT 'wrap',
  phone        TEXT,
  email        TEXT,
  website      TEXT,
  address      TEXT,
  instagram    TEXT,
  facebook     TEXT,
  logo_text    TEXT,           -- Text-based logo (e.g. "IW" for initials)
  warranty_text TEXT,
  terms_text   TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT false,
  tax_rate     NUMERIC(5,4) DEFAULT 0.0675,
  deposit_rate NUMERIC(5,4) DEFAULT 0.50,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_business_profiles" ON business_profiles FOR ALL USING (true) WITH CHECK (true);

-- Seed: Infinity Wrap Design
INSERT INTO business_profiles (
  name, type, phone, email, website, address, instagram, facebook,
  logo_text, warranty_text, terms_text, is_active, tax_rate, deposit_rate
) VALUES (
  'Infinity Wrap Design',
  'wrap',
  '(919) 649-0755',
  'infinitywrapdesign@gmail.com',
  'www.infinitywrapdesign.com',
  'North Carolina',
  '@infinitywrapdesign',
  'Infinity Wrap Design',
  'IW',
  '1-year workmanship warranty on installation. Material manufacturer warranty applies (3M: 7yr, Avery: 5yr, GF: 5yr).',
  'PAYMENT: 50% deposit required to schedule. Balance due upon completion before delivery.
DESIGN: Design approval required before printing. Revisions after approval may incur additional fees.
CANCELLATION: Deposits are non-refundable once materials have been ordered or design work has begun.
VEHICLE: Customer is responsible for ensuring vehicle is clean and in good condition prior to installation.
CHANGES: Any scope changes must be approved in writing and may affect pricing and timeline.',
  true,
  0.0675,
  0.50
),
(
  'Elite Cleaning Services',
  'cleaning',
  '',
  '',
  '',
  'North Carolina',
  '',
  '',
  'EC',
  'Satisfaction guaranteed. We will return to address any missed areas within 24 hours.',
  'PAYMENT: Due upon service completion.
CANCELLATION: 24-hour notice required to avoid cancellation fee.
ACCESS: Customer must provide access to property at scheduled time.',
  false,
  0.0675,
  0.50
);
