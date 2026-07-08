-- Phase 8: vendor-management-services — new tables (shared catalog tables already exist).

CREATE TABLE IF NOT EXISTS commerce_orders (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  customer_id varchar(36),
  order_ref varchar(64),
  status varchar(64) NOT NULL DEFAULT 'created',
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_vendor ON commerce_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_customer ON commerce_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_status ON commerce_orders (status);

CREATE TABLE IF NOT EXISTS commerce_organization_orders (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  customer_id varchar(36),
  referral_code varchar(64),
  status varchar(64) NOT NULL DEFAULT 'created',
  is_claimed boolean NOT NULL DEFAULT false,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_org_orders_vendor ON commerce_organization_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_commerce_org_orders_status ON commerce_organization_orders (status);

CREATE TABLE IF NOT EXISTS commerce_settlements (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  order_id varchar(36),
  settlement_type varchar(32) NOT NULL DEFAULT 'cash',
  status varchar(64) NOT NULL DEFAULT 'pending',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  document_url varchar(512),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_settlements_vendor ON commerce_settlements (vendor_id);
CREATE INDEX IF NOT EXISTS idx_commerce_settlements_order ON commerce_settlements (order_id);
CREATE INDEX IF NOT EXISTS idx_commerce_settlements_status ON commerce_settlements (status);

CREATE TABLE IF NOT EXISTS commerce_bookings (
  id varchar(36) PRIMARY KEY,
  customer_id varchar(36) NOT NULL,
  vendor_id varchar(36) NOT NULL,
  service_id varchar(36),
  booking_date date NOT NULL,
  time_slot varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  address_id varchar(36),
  notes text,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_bookings_customer ON commerce_bookings (customer_id);
CREATE INDEX IF NOT EXISTS idx_commerce_bookings_vendor ON commerce_bookings (vendor_id);
CREATE INDEX IF NOT EXISTS idx_commerce_bookings_status ON commerce_bookings (status);

CREATE TABLE IF NOT EXISTS vendor_plans (
  id char(36) PRIMARY KEY,
  plan_name varchar(120) NOT NULL,
  description text,
  plan_type varchar(16) NOT NULL,
  tier int NOT NULL DEFAULT 1,
  price numeric(12,2) NOT NULL DEFAULT 0,
  validity_days int NOT NULL DEFAULT 30,
  visibility_type varchar(24) NOT NULL DEFAULT 'radius',
  radius_km numeric(8,2),
  commission_percent numeric(5,2) NOT NULL DEFAULT 0,
  max_user_redemption_percent numeric(5,2) NOT NULL DEFAULT 0,
  payment_mode varchar(16) NOT NULL DEFAULT 'both',
  promo_banner_ads boolean NOT NULL DEFAULT false,
  promo_video_ads boolean NOT NULL DEFAULT false,
  promo_priority_listing boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_plans_active ON vendor_plans (is_active);

CREATE TABLE IF NOT EXISTS vendor_reviews (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36) NOT NULL,
  customer_id varchar(36),
  rating int NOT NULL,
  review text,
  status varchar(64) NOT NULL DEFAULT 'published',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON vendor_reviews (vendor_id);

CREATE TABLE IF NOT EXISTS vendor_registration_requests (
  id varchar(36) PRIMARY KEY,
  status varchar(32) NOT NULL DEFAULT 'pending',
  customer_id varchar(36) NOT NULL,
  business_name varchar(255) NOT NULL,
  owner_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(32),
  business_type varchar(64),
  address_json jsonb,
  documents_json jsonb,
  categories_json jsonb,
  description text,
  admin_notes text,
  reviewed_at timestamp,
  reviewed_by varchar(128),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_registration_requests_status ON vendor_registration_requests (status);
CREATE INDEX IF NOT EXISTS idx_vendor_registration_requests_customer ON vendor_registration_requests (customer_id);

CREATE TABLE IF NOT EXISTS vendor_media_folders (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36) NOT NULL,
  name varchar(160) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_media_folders_vendor ON vendor_media_folders (vendor_id);

CREATE TABLE IF NOT EXISTS vendor_media_assets (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36) NOT NULL,
  folder_id varchar(36),
  original_name varchar(255) NOT NULL,
  mime_type varchar(128) NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  url varchar(512) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_media_assets_vendor ON vendor_media_assets (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_media_assets_folder ON vendor_media_assets (folder_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  id int PRIMARY KEY,
  dropshipping_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dropshipping_suppliers (
  id varchar(36) PRIMARY KEY,
  name varchar(255) NOT NULL,
  contact_email varchar(255),
  contact_phone varchar(64),
  country_code varchar(8),
  currency_code varchar(8) NOT NULL DEFAULT 'INR',
  website varchar(512),
  default_lead_time_days int NOT NULL DEFAULT 7,
  default_markup_percent numeric(5,2) NOT NULL DEFAULT 20,
  status varchar(32) NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dropshipping_suppliers_status ON dropshipping_suppliers (status);

CREATE TABLE IF NOT EXISTS vendor_dropshipping_settings (
  vendor_id varchar(36) PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  default_supplier_id varchar(36),
  auto_forward_orders boolean NOT NULL DEFAULT false,
  default_margin_percent numeric(5,2) NOT NULL DEFAULT 20,
  notify_on_status_change boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dropshipping_orders (
  id varchar(36) PRIMARY KEY,
  order_id varchar(36) NOT NULL,
  vendor_id varchar(36) NOT NULL,
  supplier_id varchar(36) NOT NULL,
  supplier_order_ref varchar(128),
  items jsonb,
  cost_total numeric(12,2) NOT NULL DEFAULT 0,
  margin_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency_code varchar(8) NOT NULL DEFAULT 'INR',
  status varchar(32) NOT NULL DEFAULT 'pending',
  tracking_number varchar(128),
  tracking_url varchar(512),
  carrier varchar(128),
  forwarded_at timestamp,
  expected_delivery_date date,
  delivered_at timestamp,
  notes text,
  error_message text,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_dropshipping_orders_vendor ON dropshipping_orders (vendor_id);
CREATE INDEX IF NOT EXISTS idx_dropshipping_orders_order ON dropshipping_orders (order_id);

CREATE TABLE IF NOT EXISTS user_notifications (
  id varchar(36) PRIMARY KEY,
  user_id varchar(128) NOT NULL,
  title varchar(255) NOT NULL,
  body text,
  status varchar(32) NOT NULL DEFAULT 'unread',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_status ON user_notifications (status);
