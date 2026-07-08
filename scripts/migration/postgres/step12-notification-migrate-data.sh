#!/usr/bin/env bash
# Phase 12 — copy notification tables MySQL → Postgres staging.
set -euo pipefail
export MIGRATION_SERVICE=notification-management-services
export MIGRATION_TABLES='user_notifications,user_devices'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/mysql-to-pg-copy.mjs"
