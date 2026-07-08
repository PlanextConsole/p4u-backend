-- Phase 9: profile-management-services — new tables (customer_profiles, commerce_settlements already exist).

CREATE TABLE IF NOT EXISTS customer_addresses (
  id varchar(36) PRIMARY KEY,
  customer_id varchar(36) NOT NULL,
  label varchar(64) NOT NULL DEFAULT 'home',
  full_name varchar(255) NOT NULL,
  phone varchar(32),
  address_line1 varchar(255) NOT NULL,
  address_line2 varchar(255),
  city varchar(128) NOT NULL,
  state varchar(128) NOT NULL,
  postal_code varchar(16) NOT NULL,
  country varchar(64) NOT NULL DEFAULT 'India',
  is_default boolean NOT NULL DEFAULT false,
  latitude numeric(10,7),
  longitude numeric(10,7),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses (customer_id);

CREATE TABLE IF NOT EXISTS customer_wishlist_items (
  id varchar(36) PRIMARY KEY,
  customer_id varchar(36) NOT NULL,
  product_id varchar(64) NOT NULL,
  vendor_id varchar(36),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wishlist_customer_product ON customer_wishlist_items (customer_id, product_id);
CREATE INDEX IF NOT EXISTS idx_customer_wishlist_customer ON customer_wishlist_items (customer_id);

CREATE TABLE IF NOT EXISTS customer_referrals (
  id varchar(36) PRIMARY KEY,
  referrer_customer_id varchar(36) NOT NULL,
  referred_customer_id varchar(36) NOT NULL UNIQUE,
  referral_code varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  reward_points_earned int NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_referrer ON customer_referrals (referrer_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_referrals_code ON customer_referrals (referral_code);

CREATE TABLE IF NOT EXISTS customer_reward_points_ledger (
  id varchar(36) PRIMARY KEY,
  customer_id varchar(36) NOT NULL,
  points int NOT NULL,
  balance_after int NOT NULL,
  type varchar(32) NOT NULL,
  reference_id varchar(64),
  description varchar(255),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_reward_ledger_customer ON customer_reward_points_ledger (customer_id);

CREATE TABLE IF NOT EXISTS admin_platform_variables (
  id varchar(36) PRIMARY KEY,
  key varchar(128) NOT NULL UNIQUE,
  value jsonb NOT NULL,
  category varchar(64),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_platform_variables_active ON admin_platform_variables (is_active);
