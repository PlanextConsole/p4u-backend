-- Phase 14: admin-management-services — tables not yet in staging + grants for all admin entities.

-- ── Admin core ──
CREATE TABLE IF NOT EXISTS admin_app_screen_layouts (
  id varchar(36) PRIMARY KEY,
  screen_key varchar(64) NOT NULL,
  display_name varchar(255) NOT NULL,
  widget_config jsonb NOT NULL,
  targeting_rules jsonb,
  published boolean NOT NULL DEFAULT false,
  priority int NOT NULL DEFAULT 0,
  valid_from timestamp,
  valid_to timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_app_screen_layouts_key ON admin_app_screen_layouts (screen_key);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_sub varchar(128) NOT NULL,
  action varchar(64) NOT NULL,
  entity_type varchar(64) NOT NULL,
  entity_id varchar(36),
  metadata jsonb,
  ip_address varchar(45),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_actor ON admin_audit_logs (actor_sub);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_entity ON admin_audit_logs (entity_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs (created_at);

CREATE TABLE IF NOT EXISTS admin_bulk_upload_jobs (
  id char(36) PRIMARY KEY,
  upload_type varchar(24) NOT NULL,
  original_filename varchar(512) NOT NULL,
  stored_relative_path varchar(512) NOT NULL,
  status varchar(24) NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  result_detail jsonb,
  actor_sub varchar(255),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_type ON admin_bulk_upload_jobs (upload_type);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_status ON admin_bulk_upload_jobs (status);
CREATE INDEX IF NOT EXISTS idx_bulk_upload_created ON admin_bulk_upload_jobs (created_at);

CREATE TABLE IF NOT EXISTS admin_hierarchy_nodes (
  id varchar(36) PRIMARY KEY,
  parent_id varchar(36),
  name varchar(255) NOT NULL,
  node_type varchar(64) NOT NULL,
  responsible_user_id varchar(128),
  geo_zone jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_hierarchy_parent ON admin_hierarchy_nodes (parent_id);
CREATE INDEX IF NOT EXISTS idx_admin_hierarchy_type ON admin_hierarchy_nodes (node_type);

CREATE TABLE IF NOT EXISTS admin_push_notification_sends (
  id char(36) PRIMARY KEY,
  target_audience varchar(64) NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  deep_link varchar(512),
  target_user_ids jsonb,
  status varchar(24) NOT NULL DEFAULT 'sent',
  provider_detail text,
  actor_sub varchar(255),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_sends_created ON admin_push_notification_sends (created_at);
CREATE INDEX IF NOT EXISTS idx_push_sends_audience ON admin_push_notification_sends (target_audience);

-- ── Catalog / products ──
CREATE TABLE IF NOT EXISTS catalog_product_requests (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  category_id varchar(36),
  tax_configuration_id varchar(36),
  name varchar(255) NOT NULL,
  status varchar(64) NOT NULL DEFAULT 'pending',
  payload jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_product_requests_vendor ON catalog_product_requests (vendor_id);
CREATE INDEX IF NOT EXISTS idx_catalog_product_requests_status ON catalog_product_requests (status);

CREATE TABLE IF NOT EXISTS catalog_tax_configurations (
  id varchar(36) PRIMARY KEY,
  code varchar(128) NOT NULL,
  title varchar(255) NOT NULL,
  percentage numeric(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_tax_code ON catalog_tax_configurations (code);
CREATE INDEX IF NOT EXISTS idx_catalog_tax_active ON catalog_tax_configurations (is_active);

CREATE TABLE IF NOT EXISTS product_attribute_definitions (
  id char(36) PRIMARY KEY,
  name varchar(255) NOT NULL UNIQUE,
  type varchar(16) NOT NULL DEFAULT 'select',
  is_active boolean NOT NULL DEFAULT true,
  select_values jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_product_attribute_active ON product_attribute_definitions (is_active);

-- ── Classified (extra tables) ──
CREATE TABLE IF NOT EXISTS classified_available_cities (
  id varchar(36) PRIMARY KEY,
  name varchar(255) NOT NULL,
  state_name varchar(255),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classified_cities_name ON classified_available_cities (name);
CREATE INDEX IF NOT EXISTS idx_classified_cities_active ON classified_available_cities (is_active);

CREATE TABLE IF NOT EXISTS classified_available_areas (
  id varchar(36) PRIMARY KEY,
  city_id varchar(36) REFERENCES classified_available_cities(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  name varchar(255) NOT NULL,
  postal_code varchar(32),
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classified_areas_city ON classified_available_areas (city_id);
CREATE INDEX IF NOT EXISTS idx_classified_areas_name ON classified_available_areas (name);
CREATE INDEX IF NOT EXISTS idx_classified_areas_active ON classified_available_areas (is_active);

CREATE TABLE IF NOT EXISTS classified_services (
  id varchar(36) PRIMARY KEY,
  category_id varchar(36),
  name varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classified_services_category ON classified_services (category_id);
CREATE INDEX IF NOT EXISTS idx_classified_services_name ON classified_services (name);
CREATE INDEX IF NOT EXISTS idx_classified_services_active ON classified_services (is_active);

CREATE TABLE IF NOT EXISTS classified_vendors (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  city_id varchar(36),
  area_id varchar(36),
  "displayName" varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_classified_vendors_vendor ON classified_vendors (vendor_id);
CREATE INDEX IF NOT EXISTS idx_classified_vendors_display ON classified_vendors ("displayName");
CREATE INDEX IF NOT EXISTS idx_classified_vendors_active ON classified_vendors (is_active);

-- ── Content ──
CREATE TABLE IF NOT EXISTS content_ad_feed_items (
  id varchar(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  title varchar(255) NOT NULL,
  image_url varchar(512),
  redirect_url varchar(512),
  status varchar(64) NOT NULL DEFAULT 'active',
  sort_order int NOT NULL DEFAULT 0,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_ad_feed_status ON content_ad_feed_items (status);

CREATE TABLE IF NOT EXISTS content_banners (
  id varchar(36) PRIMARY KEY,
  title varchar(255) NOT NULL,
  image_url varchar(512) NOT NULL,
  redirect_url varchar(512),
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_banners_active ON content_banners (is_active);

CREATE TABLE IF NOT EXISTS content_moderation_logs (
  id varchar(36) PRIMARY KEY,
  post_id varchar(36),
  status varchar(64) NOT NULL DEFAULT 'pending',
  reason_code varchar(64),
  review_notes text,
  reviewed_by varchar(128),
  reviewed_at timestamp,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_moderation_post ON content_moderation_logs (post_id);
CREATE INDEX IF NOT EXISTS idx_content_moderation_status ON content_moderation_logs (status);

CREATE TABLE IF NOT EXISTS content_popup_banners (
  id varchar(36) PRIMARY KEY,
  title varchar(255) NOT NULL,
  image_url varchar(512) NOT NULL,
  redirect_url varchar(512),
  is_active boolean NOT NULL DEFAULT true,
  valid_from timestamp,
  valid_to timestamp,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_popup_active ON content_popup_banners (is_active);

CREATE TABLE IF NOT EXISTS content_posts (
  id varchar(36) PRIMARY KEY,
  author_customer_id varchar(36),
  author_vendor_id varchar(36),
  content text,
  status varchar(64) NOT NULL DEFAULT 'published',
  media_json jsonb,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_posts_status ON content_posts (status);

CREATE TABLE IF NOT EXISTS content_website_queries (
  id varchar(36) PRIMARY KEY,
  full_name varchar(255),
  email varchar(255),
  phone varchar(32),
  message text,
  status varchar(64) NOT NULL DEFAULT 'new',
  resolved_by varchar(128),
  resolved_at timestamp,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_content_website_queries_status ON content_website_queries (status);

-- ── Media library ──
CREATE TABLE IF NOT EXISTS media_library_folders (
  id char(36) PRIMARY KEY,
  name varchar(160) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE,
  kind varchar(24) NOT NULL DEFAULT 'general',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_library_folders_kind ON media_library_folders (kind);

CREATE TABLE IF NOT EXISTS media_library_assets (
  id char(36) PRIMARY KEY,
  folder_id char(36) NOT NULL REFERENCES media_library_folders (id) ON DELETE CASCADE,
  original_name varchar(512) NOT NULL,
  file_url text NOT NULL,
  relative_path varchar(512) NOT NULL,
  mime varchar(160) NOT NULL,
  size_bytes bigint NOT NULL,
  storage_kind varchar(16) NOT NULL DEFAULT 'local',
  b2_key varchar(1024),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_media_library_assets_folder ON media_library_assets (folder_id);
CREATE INDEX IF NOT EXISTS idx_media_library_assets_storage ON media_library_assets (storage_kind);

-- ── POS ──
CREATE TABLE IF NOT EXISTS pos_categories (
  id varchar(36) PRIMARY KEY,
  name varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pos_categories_name ON pos_categories (name);
CREATE INDEX IF NOT EXISTS idx_pos_categories_active ON pos_categories (is_active);

CREATE TABLE IF NOT EXISTS pos_products (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  category_id varchar(36),
  name varchar(255) NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pos_products_vendor ON pos_products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_category ON pos_products (category_id);
CREATE INDEX IF NOT EXISTS idx_pos_products_name ON pos_products (name);
CREATE INDEX IF NOT EXISTS idx_pos_products_active ON pos_products (is_active);

CREATE TABLE IF NOT EXISTS pos_vendors (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  name varchar(255) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pos_vendors_name ON pos_vendors (name);
CREATE INDEX IF NOT EXISTS idx_pos_vendors_active ON pos_vendors (is_active);

-- ── Vendor enquiries ──
CREATE TABLE IF NOT EXISTS vendor_enquiries (
  id varchar(36) PRIMARY KEY,
  vendor_id varchar(36),
  contact_name varchar(255),
  phone varchar(32),
  email varchar(255),
  message text,
  status varchar(64) NOT NULL DEFAULT 'new',
  workflow_stage varchar(64),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_vendor_enquiries_vendor ON vendor_enquiries (vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_enquiries_status ON vendor_enquiries (status);

-- ── Homes ──
CREATE TABLE IF NOT EXISTS homes_amenities (
  id varchar(36) PRIMARY KEY,
  name varchar(120) NOT NULL,
  icon varchar(80),
  category varchar(80) NOT NULL DEFAULT 'General',
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homes_amenities_name ON homes_amenities (name);
CREATE INDEX IF NOT EXISTS idx_homes_amenities_category ON homes_amenities (category);
CREATE INDEX IF NOT EXISTS idx_homes_amenities_active ON homes_amenities (is_active);

CREATE TABLE IF NOT EXISTS homes_filter_options (
  id varchar(36) PRIMARY KEY,
  filter_type varchar(80) NOT NULL,
  label varchar(120) NOT NULL,
  value varchar(120) NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homes_filter_type ON homes_filter_options (filter_type);
CREATE INDEX IF NOT EXISTS idx_homes_filter_value ON homes_filter_options (value);
CREATE INDEX IF NOT EXISTS idx_homes_filter_active ON homes_filter_options (is_active);

CREATE TABLE IF NOT EXISTS homes_localities (
  id varchar(36) PRIMARY KEY,
  name varchar(140) NOT NULL,
  city varchar(120) NOT NULL,
  is_popular boolean NOT NULL DEFAULT false,
  avg_rent numeric(12,2) NOT NULL DEFAULT 0,
  avg_sale_price numeric(14,2) NOT NULL DEFAULT 0,
  life_score numeric(4,1) NOT NULL DEFAULT 0,
  score_breakdown jsonb,
  seo_title varchar(255),
  seo_description text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homes_localities_name ON homes_localities (name);
CREATE INDEX IF NOT EXISTS idx_homes_localities_city ON homes_localities (city);
CREATE INDEX IF NOT EXISTS idx_homes_localities_active ON homes_localities (is_active);

CREATE TABLE IF NOT EXISTS homes_plans (
  id varchar(36) PRIMARY KEY,
  plan_type varchar(32) NOT NULL DEFAULT 'owner',
  name varchar(120) NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  duration_days int NOT NULL DEFAULT 30,
  listing_limit int NOT NULL DEFAULT 0,
  contact_reveals int NOT NULL DEFAULT 0,
  visibility_boost boolean NOT NULL DEFAULT false,
  features jsonb,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homes_plans_type ON homes_plans (plan_type);
CREATE INDEX IF NOT EXISTS idx_homes_plans_active ON homes_plans (is_active);

CREATE TABLE IF NOT EXISTS homes_property_listings (
  id varchar(36) PRIMARY KEY,
  title varchar(180) NOT NULL,
  locality varchar(140),
  city varchar(120),
  listing_type varchar(32) NOT NULL DEFAULT 'rent',
  property_type varchar(80) NOT NULL DEFAULT 'Apartment',
  price numeric(14,2) NOT NULL DEFAULT 0,
  posted_by varchar(120),
  photo_count int NOT NULL DEFAULT 0,
  moderation_status varchar(32) NOT NULL DEFAULT 'pending',
  is_reported boolean NOT NULL DEFAULT false,
  is_auto_flagged boolean NOT NULL DEFAULT false,
  submitted_at timestamp,
  details jsonb,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homes_properties_status ON homes_property_listings (moderation_status);

CREATE TABLE IF NOT EXISTS homes_cms_content (
  id varchar(36) PRIMARY KEY,
  content_type varchar(40) NOT NULL,
  title varchar(180) NOT NULL,
  content text,
  image_url varchar(500),
  link_url varchar(500),
  start_date date,
  end_date date,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_homes_cms_type ON homes_cms_content (content_type);
CREATE INDEX IF NOT EXISTS idx_homes_cms_active ON homes_cms_content (is_active);

-- ── Food ──
CREATE TABLE IF NOT EXISTS food_restaurants (
  id varchar(36) PRIMARY KEY,
  title varchar(160) NOT NULL,
  tagline varchar(180),
  description text,
  cuisines jsonb,
  address varchar(255) NOT NULL,
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone varchar(30),
  vendor_id varchar(80),
  cover_image_url varchar(500),
  banner_url varchar(500),
  logo_url varchar(500),
  gallery_urls jsonb,
  fssai_license varchar(120),
  opening_time varchar(20),
  closing_time varchar(20),
  avg_prep_min int NOT NULL DEFAULT 20,
  delivery_radius_km numeric(8,2) NOT NULL DEFAULT 8,
  packaging_fee numeric(10,2) NOT NULL DEFAULT 15,
  min_order numeric(10,2) NOT NULL DEFAULT 99,
  commission_percent numeric(5,2) NOT NULL DEFAULT 20,
  is_pure_veg boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_food_restaurants_active ON food_restaurants (is_active);

CREATE TABLE IF NOT EXISTS food_riders (
  id varchar(36) PRIMARY KEY,
  name varchar(140) NOT NULL,
  mobile varchar(30),
  email varchar(160),
  vehicle_type varchar(40) NOT NULL DEFAULT 'Bike',
  vehicle_no varchar(40),
  kyc_status varchar(30) NOT NULL DEFAULT 'pending',
  is_active boolean NOT NULL DEFAULT true,
  pending_balance numeric(12,2) NOT NULL DEFAULT 0,
  documents jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_food_riders_kyc ON food_riders (kyc_status);
CREATE INDEX IF NOT EXISTS idx_food_riders_active ON food_riders (is_active);

CREATE TABLE IF NOT EXISTS food_orders (
  id varchar(36) PRIMARY KEY,
  order_no varchar(60) NOT NULL,
  restaurant_id varchar(80),
  restaurant_name varchar(160),
  customer_name varchar(140),
  rider_id varchar(80),
  total numeric(12,2) NOT NULL DEFAULT 0,
  status varchar(40) NOT NULL DEFAULT 'pending',
  payment_status varchar(40) NOT NULL DEFAULT 'pending',
  items jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_food_orders_status ON food_orders (status);

CREATE TABLE IF NOT EXISTS food_coupons (
  id varchar(36) PRIMARY KEY,
  code varchar(60) NOT NULL UNIQUE,
  title varchar(160) NOT NULL,
  description text,
  discount_type varchar(30) NOT NULL DEFAULT 'flat',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  max_discount numeric(10,2),
  min_order numeric(10,2) NOT NULL DEFAULT 0,
  per_customer_limit int NOT NULL DEFAULT 1,
  total_usage_limit int,
  platform_wide boolean NOT NULL DEFAULT true,
  starts_at timestamp,
  expires_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_food_coupons_active ON food_coupons (is_active);

CREATE TABLE IF NOT EXISTS food_rider_settlements (
  id varchar(36) PRIMARY KEY,
  rider_id varchar(80) NOT NULL,
  rider_name varchar(140) NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status varchar(40) NOT NULL DEFAULT 'pending',
  paid_at timestamp,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_food_rider_settlements_status ON food_rider_settlements (status);

-- ── Grants for p4u_app (all admin entity tables) ──
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO p4u_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO p4u_app;
