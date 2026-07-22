import { AppDataSource } from './database';

const statements = [
  `CREATE TABLE IF NOT EXISTS food_restaurants (
    id varchar(36) PRIMARY KEY, vendor_id varchar(36) NOT NULL UNIQUE,
    name varchar(160) NOT NULL, tagline varchar(255) NULL, description text NULL,
    cuisine json NULL, veg_only boolean NOT NULL DEFAULT false,
    cover_image varchar(1024) NULL, logo_url varchar(1024) NULL, fssai_license varchar(64) NULL,
    address text NOT NULL, city_id varchar(36) NULL, area_id varchar(36) NULL,
    latitude decimal(10,7) NULL, longitude decimal(10,7) NULL,
    phone varchar(32) NULL, email varchar(255) NULL, opening_time varchar(8) NULL, closing_time varchar(8) NULL,
    avg_prep_minutes int NOT NULL DEFAULT 30, delivery_radius_km decimal(6,2) NOT NULL DEFAULT 10,
    packaging_fee decimal(12,2) NOT NULL DEFAULT 0, min_order_amount decimal(12,2) NOT NULL DEFAULT 0,
    commission_rate decimal(5,2) NOT NULL DEFAULT 0, status varchar(24) NOT NULL DEFAULT 'offline',
    is_active boolean NOT NULL DEFAULT false, rating decimal(3,2) NOT NULL DEFAULT 0,
    reviews_count int NOT NULL DEFAULT 0, total_orders int NOT NULL DEFAULT 0, gallery_urls json NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS food_menu_categories (
    id varchar(36) PRIMARY KEY, restaurant_id varchar(36) NOT NULL, name varchar(120) NOT NULL,
    display_order int NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
    CONSTRAINT fk_food_category_restaurant FOREIGN KEY (restaurant_id)
      REFERENCES food_restaurants(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_menu_items (
    id varchar(36) PRIMARY KEY, restaurant_id varchar(36) NOT NULL, category_id varchar(36) NULL,
    name varchar(160) NOT NULL, description text NULL, price decimal(12,2) NOT NULL,
    discounted_price decimal(12,2) NULL, is_veg boolean NOT NULL DEFAULT true,
    spice_level varchar(24) NULL, image_url varchar(1024) NULL, addons json NULL, customizations json NULL,
    serves int NOT NULL DEFAULT 1, prep_minutes int NOT NULL DEFAULT 20, gst_rate decimal(5,2) NOT NULL DEFAULT 5,
    in_stock boolean NOT NULL DEFAULT true, is_bestseller boolean NOT NULL DEFAULT false,
    display_order int NOT NULL DEFAULT 0, dietary_tags json NULL, calories int NULL, gallery_urls json NULL,
    order_count int NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_item_restaurant FOREIGN KEY (restaurant_id)
      REFERENCES food_restaurants(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_item_category FOREIGN KEY (category_id)
      REFERENCES food_menu_categories(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS food_orders (
    id varchar(36) PRIMARY KEY, order_ref varchar(64) NOT NULL UNIQUE,
    customer_id varchar(36) NOT NULL, customer_name varchar(160) NULL, customer_phone varchar(32) NULL,
    restaurant_id varchar(36) NOT NULL, restaurant_name varchar(160) NOT NULL, items json NOT NULL,
    subtotal decimal(12,2) NOT NULL DEFAULT 0, packaging_fee decimal(12,2) NOT NULL DEFAULT 0,
    delivery_fee decimal(12,2) NOT NULL DEFAULT 0, rider_tip decimal(12,2) NOT NULL DEFAULT 0,
    gst decimal(12,2) NOT NULL DEFAULT 0, platform_fee decimal(12,2) NOT NULL DEFAULT 0,
    discount decimal(12,2) NOT NULL DEFAULT 0, points_used int NOT NULL DEFAULT 0,
    total decimal(12,2) NOT NULL DEFAULT 0, rider_payout decimal(12,2) NOT NULL DEFAULT 0,
    restaurant_payout decimal(12,2) NOT NULL DEFAULT 0, platform_cut decimal(12,2) NOT NULL DEFAULT 0,
    delivery_address text NOT NULL, delivery_lat decimal(10,7) NULL, delivery_lng decimal(10,7) NULL,
    distance_km decimal(7,2) NULL, eta_minutes int NULL, handover_otp varchar(6) NOT NULL,
    payment_method varchar(32) NOT NULL, payment_status varchar(24) NOT NULL DEFAULT 'pending',
    status varchar(32) NOT NULL DEFAULT 'placed', customer_notes text NULL, cancellation_reason text NULL,
    scheduled_for timestamp NULL, placed_at timestamp NOT NULL, accepted_at timestamp NULL,
    ready_at timestamp NULL, picked_up_at timestamp NULL, delivered_at timestamp NULL, cancelled_at timestamp NULL,
    metadata json NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_order_restaurant FOREIGN KEY (restaurant_id) REFERENCES food_restaurants(id)
  )`,
  `CREATE TABLE IF NOT EXISTS food_order_status_history (
    id varchar(36) PRIMARY KEY, order_id varchar(36) NOT NULL, status varchar(32) NOT NULL,
    changed_by varchar(36) NULL, note text NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_status_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_order_chats (
    id varchar(36) PRIMARY KEY, order_id varchar(36) NOT NULL, sender_id varchar(36) NOT NULL,
    sender_role varchar(20) NOT NULL, message text NOT NULL, read_at timestamp NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_chat_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_reviews (
    id varchar(36) PRIMARY KEY, order_id varchar(36) NOT NULL UNIQUE, customer_id varchar(36) NOT NULL,
    restaurant_id varchar(36) NOT NULL, food_rating int NOT NULL, delivery_rating int NULL,
    comment text NULL, image_urls json NULL, is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_review_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_review_restaurant FOREIGN KEY (restaurant_id) REFERENCES food_restaurants(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_coupons (
    id varchar(36) PRIMARY KEY, code varchar(64) NOT NULL UNIQUE, title varchar(160) NOT NULL, description text NULL,
    discount_type varchar(16) NOT NULL DEFAULT 'flat', discount_value decimal(12,2) NOT NULL DEFAULT 0,
    max_discount decimal(12,2) NULL, min_order_amount decimal(12,2) NOT NULL DEFAULT 0, restaurant_id varchar(36) NULL,
    is_platform_wide boolean NOT NULL DEFAULT false, per_customer_limit int NOT NULL DEFAULT 1,
    total_usage_limit int NULL, usage_count int NOT NULL DEFAULT 0, starts_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp NULL, is_active boolean NOT NULL DEFAULT true, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_coupon_restaurant FOREIGN KEY (restaurant_id) REFERENCES food_restaurants(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_coupon_redemptions (
    id varchar(36) PRIMARY KEY, coupon_id varchar(36) NOT NULL, coupon_code varchar(64) NOT NULL, customer_id varchar(36) NOT NULL,
    order_id varchar(36) NOT NULL, discount_applied decimal(12,2) NOT NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_redemption_coupon FOREIGN KEY (coupon_id) REFERENCES food_coupons(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_redemption_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_payments (
    id varchar(36) PRIMARY KEY, order_id varchar(36) NOT NULL, customer_id varchar(36) NOT NULL,
    txn_type varchar(20) NOT NULL DEFAULT 'payment', payment_method varchar(32) NOT NULL, payment_provider varchar(32) NOT NULL DEFAULT 'manual',
    amount decimal(12,2) NOT NULL, currency varchar(8) NOT NULL DEFAULT 'INR', status varchar(24) NOT NULL DEFAULT 'pending',
    provider_order_id varchar(128) NULL, provider_payment_id varchar(128) NULL, provider_refund_id varchar(128) NULL,
    provider_signature varchar(255) NULL, failure_reason text NULL, metadata json NULL,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_payment_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_refunds (
    id varchar(36) PRIMARY KEY, order_id varchar(36) NOT NULL, customer_id varchar(36) NOT NULL, amount decimal(12,2) NOT NULL,
    reason varchar(255) NOT NULL, notes text NULL, status varchar(24) NOT NULL DEFAULT 'pending', refund_method varchar(24) NOT NULL DEFAULT 'original',
    provider_refund_id varchar(128) NULL, initiated_by varchar(36) NULL, initiated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp NULL, metadata json NULL,
    CONSTRAINT fk_food_refund_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_invoices (
    id varchar(36) PRIMARY KEY, invoice_no varchar(64) NOT NULL UNIQUE, order_id varchar(36) NOT NULL UNIQUE,
    customer_id varchar(36) NOT NULL, restaurant_id varchar(36) NOT NULL, subtotal decimal(12,2) NOT NULL, tax decimal(12,2) NOT NULL,
    delivery_fee decimal(12,2) NOT NULL, packaging_fee decimal(12,2) NOT NULL, platform_fee decimal(12,2) NOT NULL,
    discount decimal(12,2) NOT NULL, total decimal(12,2) NOT NULL, payment_method varchar(32) NULL,
    payment_id varchar(128) NULL, generated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, metadata json NULL,
    CONSTRAINT fk_food_invoice_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_riders (
    id varchar(36) PRIMARY KEY, user_id varchar(36) NOT NULL UNIQUE, name varchar(160) NOT NULL, phone varchar(32) NOT NULL,
    vehicle_type varchar(32) NULL, vehicle_number varchar(64) NULL, kyc_status varchar(24) NOT NULL DEFAULT 'pending',
    status varchar(24) NOT NULL DEFAULT 'active', is_online boolean NOT NULL DEFAULT false, current_lat decimal(10,7) NULL,
    current_lng decimal(10,7) NULL, last_location_at timestamp NULL, max_concurrent_orders int NOT NULL DEFAULT 3,
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS food_rider_assignments (
    id varchar(36) PRIMARY KEY, order_id varchar(36) NOT NULL, rider_id varchar(36) NOT NULL,
    status varchar(24) NOT NULL DEFAULT 'offered', distance_km decimal(8,2) NOT NULL DEFAULT 0,
    payout_amount decimal(12,2) NOT NULL DEFAULT 0, offered_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at timestamp NULL, picked_up_at timestamp NULL, delivered_at timestamp NULL, rejection_reason text NULL,
    UNIQUE(order_id, rider_id), CONSTRAINT fk_food_assignment_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_assignment_rider FOREIGN KEY (rider_id) REFERENCES food_riders(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_rider_locations (
    id varchar(36) PRIMARY KEY, rider_id varchar(36) NOT NULL, order_id varchar(36) NULL,
    latitude decimal(10,7) NOT NULL, longitude decimal(10,7) NOT NULL, recorded_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_location_rider FOREIGN KEY (rider_id) REFERENCES food_riders(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_location_order FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS food_stock_subscriptions (
    id varchar(36) PRIMARY KEY, menu_item_id varchar(36) NOT NULL, customer_id varchar(36) NOT NULL,
    notified_at timestamp NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(menu_item_id, customer_id),
    CONSTRAINT fk_food_stock_item FOREIGN KEY (menu_item_id) REFERENCES food_menu_items(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_notifications (
    id varchar(36) PRIMARY KEY, recipient_id varchar(36) NOT NULL, recipient_role varchar(20) NOT NULL,
    type varchar(64) NOT NULL, title varchar(160) NOT NULL, body text NOT NULL, deep_link varchar(512) NULL,
    data json NULL, read_at timestamp NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS food_rider_settlements (
    id varchar(36) PRIMARY KEY, rider_id varchar(36) NOT NULL, assignment_id varchar(36) NOT NULL UNIQUE,
    amount decimal(12,2) NOT NULL, status varchar(24) NOT NULL DEFAULT 'pending', transaction_ref varchar(128) NULL,
    paid_at timestamp NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_settlement_rider FOREIGN KEY (rider_id) REFERENCES food_riders(id) ON DELETE CASCADE,
    CONSTRAINT fk_food_settlement_assignment FOREIGN KEY (assignment_id) REFERENCES food_rider_assignments(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS food_combos (
    id varchar(36) PRIMARY KEY, restaurant_id varchar(36) NOT NULL, name varchar(160) NOT NULL,
    description text NULL, item_ids json NOT NULL, price decimal(12,2) NOT NULL, image_url varchar(1024) NULL,
    in_stock boolean NOT NULL DEFAULT true, is_active boolean NOT NULL DEFAULT true, starts_at timestamp NULL,
    expires_at timestamp NULL, created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_food_combo_restaurant FOREIGN KEY (restaurant_id) REFERENCES food_restaurants(id) ON DELETE CASCADE
  )`,
];

const foodOrderColumns = [
  'coupon_code varchar(64) NULL', 'refund_status varchar(24) NULL',
  'refund_amount decimal(12,2) NOT NULL DEFAULT 0', 'invoice_no varchar(64) NULL',
];

/** Create only food-domain tables; existing commerce tables are never synchronized or altered. */
export async function ensureFoodSchema(): Promise<void> {
  for (const statement of statements) await AppDataSource.query(statement);
  for (const column of foodOrderColumns) {
    try { await AppDataSource.query(`ALTER TABLE food_orders ADD COLUMN ${column}`); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate column|already exists/i.test(message)) throw error;
    }
  }
}
