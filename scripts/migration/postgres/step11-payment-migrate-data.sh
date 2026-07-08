#!/usr/bin/env bash
# Phase 11 — copy payment tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=payment-management-services
export MIGRATION_TABLES='user_payment_intents'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
