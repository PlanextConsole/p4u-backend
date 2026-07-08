-- Phase 6: auth-management-services tables for Postgres staging.

CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  username      varchar(255) NOT NULL UNIQUE,
  email         varchar(255) NOT NULL UNIQUE,
  keycloak_id   varchar(255) NOT NULL,
  user_type     varchar(255) NOT NULL,
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_occupations (
  id          varchar(36) PRIMARY KEY,
  name        varchar(255) NOT NULL,
  sort_order  int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_occupations_name ON customer_occupations (name);

CREATE TABLE IF NOT EXISTS customer_profiles (
  id                varchar(36) PRIMARY KEY,
  full_name         varchar(255) NOT NULL,
  keycloak_user_id  varchar(128),
  metadata          jsonb,
  phone             varchar(32),
  email             varchar(255),
  status            varchar(32) NOT NULL DEFAULT 'active',
  occupation_id     varchar(36),
  state             varchar(128),
  district          varchar(128),
  area_locality     varchar(255),
  pincode           varchar(16),
  latitude          numeric(10,7),
  longitude         numeric(10,7),
  referral_code     varchar(64),
  created_at        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_keycloak_user_id ON customer_profiles (keycloak_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_email ON customer_profiles (email);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_phone ON customer_profiles (phone);
CREATE INDEX IF NOT EXISTS idx_customer_profiles_status ON customer_profiles (status);

CREATE TABLE IF NOT EXISTS vendor_signup_requests (
  id            varchar(36) PRIMARY KEY,
  request_type  varchar(64) NOT NULL DEFAULT 'signup',
  payload       jsonb NOT NULL,
  status        varchar(32) NOT NULL DEFAULT 'pending',
  created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_signup_requests_status ON vendor_signup_requests (status);

CREATE TABLE IF NOT EXISTS catalog_vendors (
  id                        varchar(36) PRIMARY KEY,
  business_name             varchar(255) NOT NULL,
  owner_name                varchar(255) NOT NULL,
  email                     varchar(255),
  phone                     varchar(32),
  status                    varchar(32) NOT NULL DEFAULT 'not_verified',
  kyc_status                varchar(32) NOT NULL DEFAULT 'not_started',
  categories_json           jsonb,
  address_json              jsonb,
  notes                     text,
  keycloak_user_id          varchar(128),
  created_at                timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  logo_url                  varchar(512),
  age                       int,
  gender                    varchar(16),
  thumbnail_url             varchar(512),
  banner_url                varchar(512),
  gst                       varchar(64),
  pan                       varchar(64),
  secondary_phone           varchar(32),
  membership_status         varchar(32),
  experience                varchar(255),
  trending                  boolean NOT NULL DEFAULT false,
  applied_referral_code     varchar(64),
  about_business            text,
  services_json             jsonb,
  commission_rate           numeric(5,2),
  documents_json            jsonb,
  bank_json                 jsonb,
  vendor_kind               varchar(16) NOT NULL DEFAULT 'product',
  vendor_type               varchar(16) NOT NULL DEFAULT 'PRODUCT',
  vendor_plan_id            varchar(36),
  enrollment_cost           numeric(12,2),
  coverage_radius_km        numeric(8,2),
  restriction               varchar(32),
  self_delivery             boolean NOT NULL DEFAULT false,
  max_redemption_percent    numeric(5,2)
);
CREATE INDEX IF NOT EXISTS idx_catalog_vendors_email ON catalog_vendors (email);
CREATE INDEX IF NOT EXISTS idx_catalog_vendors_phone ON catalog_vendors (phone);
CREATE INDEX IF NOT EXISTS idx_catalog_vendors_status ON catalog_vendors (status);
CREATE INDEX IF NOT EXISTS idx_catalog_vendors_keycloak_user_id ON catalog_vendors (keycloak_user_id);
