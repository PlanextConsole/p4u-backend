#!/usr/bin/env bash
# Phase 8 — copy vendor tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=vendor-management-services
export MIGRATION_TABLES='vendor_plans,platform_settings,product_categories,service_categories,catalog_vendors,catalog_service_items,catalog_products,catalog_product_variations,catalog_vendor_services,commerce_orders,commerce_organization_orders,commerce_settlements,commerce_bookings,vendor_media_folders,vendor_media_assets,dropshipping_suppliers,vendor_dropshipping_settings,dropshipping_orders,user_notifications,vendor_reviews,vendor_registration_requests'
export MIGRATION_BOOL_COLS='is_active,trending,self_delivery,availability,emergency,is_available,is_claimed,dropshipping_enabled,enabled,auto_forward_orders,notify_on_status_change,promo_banner_ads,promo_video_ads,promo_priority_listing'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
