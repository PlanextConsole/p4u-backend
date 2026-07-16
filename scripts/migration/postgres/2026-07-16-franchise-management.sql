BEGIN;

CREATE TABLE IF NOT EXISTS franchise_plans (
  id varchar(36) PRIMARY KEY,
  plan_name varchar(120) NOT NULL,
  description text,
  plan_type varchar(16) NOT NULL CHECK (plan_type IN ('local', 'vip')),
  tier int NOT NULL DEFAULT 1,
  price numeric(12,2) NOT NULL DEFAULT 0,
  validity_days int NOT NULL DEFAULT 365,
  visibility_type varchar(24) NOT NULL DEFAULT 'radius' CHECK (visibility_type IN ('radius', 'city', 'state', 'country')),
  radius_km numeric(8,2),
  royalty_percent numeric(5,2) NOT NULL DEFAULT 0,
  max_user_redemption_percent numeric(5,2) NOT NULL DEFAULT 0,
  payment_mode varchar(16) NOT NULL DEFAULT 'both' CHECK (payment_mode IN ('both', 'online', 'offline')),
  promo_banner_ads boolean NOT NULL DEFAULT false,
  promo_video_ads boolean NOT NULL DEFAULT false,
  promo_priority_listing boolean NOT NULL DEFAULT false,
  territory_exclusive boolean NOT NULL DEFAULT true,
  training_included boolean NOT NULL DEFAULT false,
  support_level varchar(32),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_franchise_plans_type ON franchise_plans(plan_type);
CREATE INDEX IF NOT EXISTS idx_franchise_plans_active ON franchise_plans(is_active);

CREATE TABLE IF NOT EXISTS franchise_registrations (
  id varchar(36) PRIMARY KEY,
  status varchar(32) NOT NULL DEFAULT 'pending',
  plan_id varchar(36) REFERENCES franchise_plans(id) ON DELETE RESTRICT,
  applicant_name varchar(255) NOT NULL,
  business_name varchar(255),
  email varchar(255),
  phone varchar(32),
  city varchar(120),
  state varchar(120),
  pincode varchar(16),
  address text,
  preferred_territory varchar(255),
  investment_budget numeric(14,2),
  experience_years int,
  documents_json jsonb,
  admin_notes text,
  rejection_reason text,
  reviewed_at timestamp,
  reviewed_by varchar(128),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_franchise_registrations_status ON franchise_registrations(status);
CREATE INDEX IF NOT EXISTS idx_franchise_registrations_plan ON franchise_registrations(plan_id);
CREATE INDEX IF NOT EXISTS idx_franchise_registrations_contact ON franchise_registrations(phone, email);

CREATE TABLE IF NOT EXISTS franchises (
  id varchar(36) PRIMARY KEY,
  registration_id varchar(36) NOT NULL UNIQUE REFERENCES franchise_registrations(id) ON DELETE RESTRICT,
  plan_id varchar(36) NOT NULL REFERENCES franchise_plans(id) ON DELETE RESTRICT,
  franchise_code varchar(32) NOT NULL UNIQUE,
  business_name varchar(255),
  owner_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(32),
  city varchar(120),
  state varchar(120),
  pincode varchar(16),
  address text,
  territory_description text,
  hierarchy_node_id varchar(36) REFERENCES admin_hierarchy_nodes(id) ON DELETE SET NULL,
  status varchar(24) NOT NULL DEFAULT 'active',
  plan_start_date date NOT NULL,
  plan_end_date date NOT NULL,
  payment_status varchar(24) NOT NULL DEFAULT 'pending',
  payment_transaction_id varchar(128),
  royalty_percent numeric(5,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_franchises_status ON franchises(status);
CREATE INDEX IF NOT EXISTS idx_franchises_plan ON franchises(plan_id);
CREATE INDEX IF NOT EXISTS idx_franchises_payment ON franchises(payment_status);

CREATE TABLE IF NOT EXISTS franchise_registration_payments (
  id varchar(36) PRIMARY KEY,
  registration_id varchar(36) NOT NULL REFERENCES franchise_registrations(id) ON DELETE CASCADE,
  franchise_id varchar(36) REFERENCES franchises(id) ON DELETE SET NULL,
  plan_id varchar(36) NOT NULL REFERENCES franchise_plans(id) ON DELETE RESTRICT,
  amount numeric(14,2) NOT NULL,
  currency varchar(8) NOT NULL DEFAULT 'INR',
  payment_mode varchar(24) NOT NULL,
  payment_status varchar(24) NOT NULL DEFAULT 'pending',
  transaction_id varchar(128),
  gateway_reference varchar(128),
  paid_at timestamp,
  recorded_by varchar(128),
  notes text,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_franchise_payments_registration ON franchise_registration_payments(registration_id);
CREATE INDEX IF NOT EXISTS idx_franchise_payments_status ON franchise_registration_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_franchise_payments_created ON franchise_registration_payments(created_at);

CREATE TABLE IF NOT EXISTS franchise_business_projections (
  id varchar(36) PRIMARY KEY,
  registration_id varchar(36) REFERENCES franchise_registrations(id) ON DELETE SET NULL,
  franchise_id varchar(36) REFERENCES franchises(id) ON DELETE SET NULL,
  plan_id varchar(36) REFERENCES franchise_plans(id) ON DELETE SET NULL,
  territory_name varchar(255) NOT NULL,
  city varchar(120),
  state varchar(120),
  initial_investment numeric(16,2) NOT NULL DEFAULT 0,
  franchise_fee numeric(16,2) NOT NULL DEFAULT 0,
  setup_cost numeric(16,2),
  monthly_opex numeric(16,2),
  projected_monthly_revenue numeric(16,2) NOT NULL DEFAULT 0,
  projected_annual_revenue numeric(16,2) NOT NULL DEFAULT 0,
  projected_break_even_months int,
  projected_roi_percent numeric(7,2),
  population_estimate int,
  market_notes text,
  prepared_by varchar(128),
  status varchar(24) NOT NULL DEFAULT 'draft',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_franchise_projections_status ON franchise_business_projections(status);
CREATE INDEX IF NOT EXISTS idx_franchise_projections_registration ON franchise_business_projections(registration_id);
CREATE INDEX IF NOT EXISTS idx_franchise_projections_franchise ON franchise_business_projections(franchise_id);

COMMIT;
