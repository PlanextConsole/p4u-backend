#!/usr/bin/env bash
# Phase 10 — copy commerce tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=commerce-management-services
export MIGRATION_TABLES='vendor_plans,admin_platform_variables,product_categories,catalog_service_items,catalog_vendors,catalog_products,customer_profiles,customer_reward_points_ledger,commerce_coupons,commerce_carts,commerce_cart_items,commerce_orders,commerce_bookings,commerce_settlements,commerce_coupon_usages,commerce_reviews'
export MIGRATION_BOOL_COLS='is_active,is_default,trending,self_delivery,availability,emergency,is_available,is_claimed,dropshipping_enabled,enabled,auto_forward_orders,notify_on_status_change,promo_banner_ads,promo_video_ads,promo_priority_listing'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
