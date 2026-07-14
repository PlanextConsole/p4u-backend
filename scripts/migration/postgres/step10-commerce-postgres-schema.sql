-- Phase 10: commerce-management-services — new tables (many shared tables already exist).

CREATE TABLE IF NOT EXISTS commerce_carts (
  id varchar(36) PRIMARY KEY,
  customer_id varchar(36) NOT NULL UNIQUE,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_carts_customer ON commerce_carts (customer_id);

CREATE TABLE IF NOT EXISTS commerce_cart_items (
  id varchar(36) PRIMARY KEY,
  product_id varchar(64) NOT NULL,
  vendor_id varchar(36),
  variation_id varchar(36),
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb,
  cart_id varchar(36),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_cart_items_cart ON commerce_cart_items (cart_id);

CREATE TABLE IF NOT EXISTS commerce_coupons (
  id varchar(36) PRIMARY KEY,
  status varchar(32) NOT NULL DEFAULT 'active',
  valid_from timestamp,
  valid_until timestamp,
  code varchar(32) NOT NULL UNIQUE,
  type varchar(32) NOT NULL DEFAULT 'percentage',
  value numeric(12,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(12,2) NOT NULL DEFAULT 0,
  max_discount numeric(12,2),
  usage_limit int,
  used_count int NOT NULL DEFAULT 0,
  per_user_limit int NOT NULL DEFAULT 1,
  applicable_vendor_ids jsonb,
  applicable_category_ids jsonb,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_coupons_status ON commerce_coupons (status);

CREATE TABLE IF NOT EXISTS commerce_coupon_usages (
  id varchar(36) PRIMARY KEY,
  coupon_id varchar(36) NOT NULL,
  customer_id varchar(36) NOT NULL,
  order_id varchar(36),
  discount_applied numeric(12,2) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_commerce_coupon_usages_coupon ON commerce_coupon_usages (coupon_id);
CREATE INDEX IF NOT EXISTS idx_commerce_coupon_usages_customer ON commerce_coupon_usages (customer_id);

CREATE TABLE IF NOT EXISTS commerce_reviews (
  id varchar(36) PRIMARY KEY,
  customer_id varchar(36) NOT NULL,
  target_type varchar(32) NOT NULL,
  target_id varchar(36) NOT NULL,
  rating int NOT NULL,
  title varchar(255),
  review_text text,
  images_json jsonb,
  status varchar(32) NOT NULL DEFAULT 'published',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_reviews_customer_target ON commerce_reviews (customer_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_commerce_reviews_status ON commerce_reviews (status);
