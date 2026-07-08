-- Phase 7: catalog-management-services tables (catalog_vendors already exists from auth phase).

CREATE TABLE IF NOT EXISTS product_categories (
  id varchar(36) PRIMARY KEY,
  name varchar(255) NOT NULL,
  slug varchar(128),
  availability boolean NOT NULL DEFAULT false,
  emergency boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  description text,
  thumbnail_url varchar(512),
  banner_urls jsonb,
  icon_url varchar(512),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  commission_override_percent numeric(5,2),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_categories_name ON product_categories (name);
CREATE INDEX IF NOT EXISTS idx_product_categories_slug ON product_categories (slug);
CREATE INDEX IF NOT EXISTS idx_product_categories_is_active ON product_categories (is_active);

CREATE TABLE IF NOT EXISTS product_subcategories (
  id varchar(36) PRIMARY KEY,
  product_category_id varchar(36) NOT NULL,
  name varchar(255) NOT NULL,
  slug varchar(128),
  availability boolean NOT NULL DEFAULT false,
  emergency boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  description text,
  thumbnail_url varchar(512),
  banner_urls jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_subcategories_category ON product_subcategories (product_category_id);
CREATE INDEX IF NOT EXISTS idx_product_subcategories_name ON product_subcategories (name);
CREATE INDEX IF NOT EXISTS idx_product_subcategories_is_active ON product_subcategories (is_active);

CREATE TABLE IF NOT EXISTS service_categories (
  id varchar(36) PRIMARY KEY,
  name varchar(255) NOT NULL,
  slug varchar(128),
  availability boolean NOT NULL DEFAULT false,
  emergency boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  description text,
  thumbnail_url varchar(512),
  banner_urls jsonb,
  icon_url varchar(512),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  commission_override_percent numeric(5,2),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_categories_name ON service_categories (name);
CREATE INDEX IF NOT EXISTS idx_service_categories_slug ON service_categories (slug);
CREATE INDEX IF NOT EXISTS idx_service_categories_is_active ON service_categories (is_active);

CREATE TABLE IF NOT EXISTS service_subcategories (
  id varchar(36) PRIMARY KEY,
  service_category_id varchar(36) NOT NULL,
  name varchar(255) NOT NULL,
  slug varchar(128),
  availability boolean NOT NULL DEFAULT false,
  emergency boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  description text,
  thumbnail_url varchar(512),
  banner_urls jsonb,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_category ON service_subcategories (service_category_id);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_name ON service_subcategories (name);
CREATE INDEX IF NOT EXISTS idx_service_subcategories_is_active ON service_subcategories (is_active);

CREATE TABLE IF NOT EXISTS catalog_service_items (
  id varchar(36) PRIMARY KEY,
  service_category_id varchar(36),
  service_subcategory_id varchar(36),
  name varchar(255) NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  availability boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  icon_url varchar(512),
  base_price numeric(12,2),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_service_items_name ON catalog_service_items (name);
CREATE INDEX IF NOT EXISTS idx_catalog_service_items_is_active ON catalog_service_items (is_active);
CREATE INDEX IF NOT EXISTS idx_catalog_service_items_category ON catalog_service_items (service_category_id);

CREATE TABLE IF NOT EXISTS catalog_products (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  category_id varchar(36),
  tax_configuration_id varchar(36),
  name varchar(255) NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  availability boolean NOT NULL DEFAULT false,
  service_id varchar(36),
  sell_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  final_price numeric(12,2) NOT NULL DEFAULT 0,
  duration_hours int NOT NULL DEFAULT 0,
  duration_minutes int NOT NULL DEFAULT 0,
  short_description text,
  long_description text,
  promise_p4u text,
  help_line_number text,
  thumbnail_url varchar(512),
  banner_urls jsonb,
  commission_override_percent numeric(5,2),
  moderation_status varchar(32) DEFAULT 'approved',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_products_vendor ON catalog_products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog_products (category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_name ON catalog_products (name);
CREATE INDEX IF NOT EXISTS idx_catalog_products_is_active ON catalog_products (is_active);

CREATE TABLE IF NOT EXISTS catalog_product_variations (
  id varchar(36) PRIMARY KEY,
  product_id varchar(36) NOT NULL,
  sku varchar(64),
  attributes jsonb NOT NULL DEFAULT '{}',
  sell_price numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  final_price numeric(12,2) NOT NULL DEFAULT 0,
  quantity int NOT NULL DEFAULT 0,
  thumbnail_url varchar(512),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_product_variations_product ON catalog_product_variations (product_id);

CREATE TABLE IF NOT EXISTS catalog_vendor_services (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36) NOT NULL,
  service_id varchar(36) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_vendor_services_vendor_service ON catalog_vendor_services (vendor_id, service_id);
CREATE INDEX IF NOT EXISTS idx_catalog_vendor_services_vendor ON catalog_vendor_services (vendor_id);
CREATE INDEX IF NOT EXISTS idx_catalog_vendor_services_service ON catalog_vendor_services (service_id);
