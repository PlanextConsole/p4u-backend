#!/usr/bin/env bash
# Phase 7 — copy catalog tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=catalog-management-services
export MIGRATION_TABLES='product_categories,product_subcategories,service_categories,service_subcategories,catalog_service_items,catalog_vendors,catalog_products,catalog_product_variations,catalog_vendor_services'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
