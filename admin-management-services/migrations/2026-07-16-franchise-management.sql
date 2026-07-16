CREATE TABLE IF NOT EXISTS franchise_plans (
  id varchar(36) NOT NULL PRIMARY KEY, plan_name varchar(120) NOT NULL, description text NULL,
  plan_type varchar(16) NOT NULL, tier int NOT NULL DEFAULT 1, price decimal(12,2) NOT NULL DEFAULT 0,
  validity_days int NOT NULL DEFAULT 365, visibility_type varchar(24) NOT NULL DEFAULT 'radius',
  radius_km decimal(8,2) NULL, royalty_percent decimal(5,2) NOT NULL DEFAULT 0,
  max_user_redemption_percent decimal(5,2) NOT NULL DEFAULT 0, payment_mode varchar(16) NOT NULL DEFAULT 'both',
  promo_banner_ads boolean NOT NULL DEFAULT false, promo_video_ads boolean NOT NULL DEFAULT false,
  promo_priority_listing boolean NOT NULL DEFAULT false, territory_exclusive boolean NOT NULL DEFAULT true,
  training_included boolean NOT NULL DEFAULT false, support_level varchar(32) NULL,
  is_active boolean NOT NULL DEFAULT true, metadata json NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_franchise_plans_type(plan_type), INDEX idx_franchise_plans_active(is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS franchise_registrations (
  id varchar(36) NOT NULL PRIMARY KEY, status varchar(32) NOT NULL DEFAULT 'pending',
  plan_id varchar(36) NULL, applicant_name varchar(255) NOT NULL, business_name varchar(255) NULL,
  email varchar(255) NULL, phone varchar(32) NULL, city varchar(120) NULL, state varchar(120) NULL,
  pincode varchar(16) NULL, address text NULL, preferred_territory varchar(255) NULL,
  investment_budget decimal(14,2) NULL, experience_years int NULL, documents_json json NULL,
  admin_notes text NULL, rejection_reason text NULL, reviewed_at datetime NULL, reviewed_by varchar(128) NULL,
  metadata json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_franchise_registrations_status(status), INDEX idx_franchise_registrations_plan(plan_id),
  CONSTRAINT fk_franchise_registration_plan FOREIGN KEY(plan_id) REFERENCES franchise_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS franchises (
  id varchar(36) NOT NULL PRIMARY KEY, registration_id varchar(36) NOT NULL UNIQUE, plan_id varchar(36) NOT NULL,
  franchise_code varchar(32) NOT NULL UNIQUE, business_name varchar(255) NULL, owner_name varchar(255) NOT NULL,
  email varchar(255) NULL, phone varchar(32) NULL, city varchar(120) NULL, state varchar(120) NULL,
  pincode varchar(16) NULL, address text NULL, territory_description text NULL, hierarchy_node_id varchar(36) NULL,
  status varchar(24) NOT NULL DEFAULT 'active', plan_start_date date NOT NULL, plan_end_date date NOT NULL,
  payment_status varchar(24) NOT NULL DEFAULT 'pending', payment_transaction_id varchar(128) NULL,
  royalty_percent decimal(5,2) NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true, metadata json NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_franchises_status(status), INDEX idx_franchises_plan(plan_id),
  CONSTRAINT fk_franchise_registration FOREIGN KEY(registration_id) REFERENCES franchise_registrations(id),
  CONSTRAINT fk_franchise_plan FOREIGN KEY(plan_id) REFERENCES franchise_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS franchise_registration_payments (
  id varchar(36) NOT NULL PRIMARY KEY, registration_id varchar(36) NOT NULL, franchise_id varchar(36) NULL,
  plan_id varchar(36) NOT NULL, amount decimal(14,2) NOT NULL, currency varchar(8) NOT NULL DEFAULT 'INR',
  payment_mode varchar(24) NOT NULL, payment_status varchar(24) NOT NULL DEFAULT 'pending',
  transaction_id varchar(128) NULL, gateway_reference varchar(128) NULL, paid_at datetime NULL,
  recorded_by varchar(128) NULL, notes text NULL, metadata json NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_franchise_payments_registration(registration_id), INDEX idx_franchise_payments_status(payment_status),
  CONSTRAINT fk_franchise_payment_registration FOREIGN KEY(registration_id) REFERENCES franchise_registrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_franchise_payment_franchise FOREIGN KEY(franchise_id) REFERENCES franchises(id) ON DELETE SET NULL,
  CONSTRAINT fk_franchise_payment_plan FOREIGN KEY(plan_id) REFERENCES franchise_plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS franchise_business_projections (
  id varchar(36) NOT NULL PRIMARY KEY, registration_id varchar(36) NULL, franchise_id varchar(36) NULL,
  plan_id varchar(36) NULL, territory_name varchar(255) NOT NULL, city varchar(120) NULL, state varchar(120) NULL,
  initial_investment decimal(16,2) NOT NULL DEFAULT 0, franchise_fee decimal(16,2) NOT NULL DEFAULT 0,
  setup_cost decimal(16,2) NULL, monthly_opex decimal(16,2) NULL,
  projected_monthly_revenue decimal(16,2) NOT NULL DEFAULT 0, projected_annual_revenue decimal(16,2) NOT NULL DEFAULT 0,
  projected_break_even_months int NULL, projected_roi_percent decimal(7,2) NULL, population_estimate int NULL,
  market_notes text NULL, prepared_by varchar(128) NULL, status varchar(24) NOT NULL DEFAULT 'draft',
  metadata json NULL, created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  INDEX idx_franchise_projections_status(status),
  CONSTRAINT fk_franchise_projection_registration FOREIGN KEY(registration_id) REFERENCES franchise_registrations(id) ON DELETE SET NULL,
  CONSTRAINT fk_franchise_projection_franchise FOREIGN KEY(franchise_id) REFERENCES franchises(id) ON DELETE SET NULL,
  CONSTRAINT fk_franchise_projection_plan FOREIGN KEY(plan_id) REFERENCES franchise_plans(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
