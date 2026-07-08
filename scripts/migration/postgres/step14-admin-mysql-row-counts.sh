#!/usr/bin/env bash
# Phase 14a — row counts for all admin entity tables (MySQL).
set -euo pipefail
TABLES=(
  admin_hierarchy_nodes admin_app_screen_layouts admin_audit_logs admin_platform_variables
  admin_push_notification_sends admin_bulk_upload_jobs product_categories product_subcategories
  service_categories service_subcategories catalog_service_items catalog_tax_configurations
  catalog_vendors vendor_signup_requests vendor_enquiries vendor_plans catalog_products
  catalog_product_variations catalog_product_requests catalog_vendor_services product_attribute_definitions
  customer_profiles customer_occupations customer_referrals customer_reward_points_ledger
  commerce_coupons commerce_orders commerce_organization_orders commerce_settlements commerce_reviews
  classified_available_cities classified_available_areas classified_categories classified_services
  classified_vendors classified_products content_banners content_popup_banners content_posts
  content_ad_feed_items content_moderation_logs content_website_queries user_notifications
  vendor_reviews pos_categories pos_vendors pos_products media_library_folders media_library_assets
  social_posts social_post_comments social_user_follows social_stories social_media
  homes_amenities homes_filter_options homes_localities homes_plans homes_property_listings homes_cms_content
  food_restaurants food_riders food_orders food_coupons food_rider_settlements
)
SQL=""
for t in "${TABLES[@]}"; do
  SQL+="SELECT '${t}' AS t, COUNT(*) AS c FROM \`${t}\` UNION ALL "
done
SQL="${SQL% UNION ALL }"
mysql -h localhost -u p4u -p"${MYSQL_PASSWORD:-planext4u}" p4u_admin_db -e "$SQL"
