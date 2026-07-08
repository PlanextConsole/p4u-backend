#!/usr/bin/env bash
# Phase 9 — copy profile tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=profile-management-services
export MIGRATION_TABLES='customer_profiles,customer_addresses,customer_wishlist_items,customer_referrals,customer_reward_points_ledger,commerce_settlements,admin_platform_variables'
export MIGRATION_BOOL_COLS='is_active,is_default,trending,self_delivery,availability,emergency,is_available,is_claimed,dropshipping_enabled,enabled'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
