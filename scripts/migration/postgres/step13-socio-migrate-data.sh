#!/usr/bin/env bash
# Phase 13 — copy socio tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=socio-management-services
export MIGRATION_BOOL_COLS='is_request,is_active'
export MIGRATION_TABLES='social_posts,social_post_likes,social_post_comments,social_post_saves,social_user_follows,social_stories,social_media,social_conversations,social_messages,social_conversation_state,customer_profiles,customer_reward_points_ledger,commerce_settlements,admin_platform_variables'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
