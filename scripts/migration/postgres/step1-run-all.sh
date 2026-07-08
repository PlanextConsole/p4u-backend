#!/usr/bin/env bash
# Step 1 — Run all preparation steps (backup MySQL + config, then install Postgres).
# Usage on server:
#   cd /opt/p4u/backend
#   git pull origin main
#   export MYSQL_PASSWORD='...'
#   export P4U_PG_PASSWORD='...'
#   bash scripts/migration/postgres/step1-run-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========== P4U Postgres migration — Step 1 =========="
echo ""

bash "${SCRIPT_DIR}/step1-backup-mysql.sh"
echo ""
bash "${SCRIPT_DIR}/step1-backup-config.sh"
echo ""

if [[ "$(id -u)" -eq 0 ]]; then
  bash "${SCRIPT_DIR}/step1-install-postgres.sh"
else
  echo "==> To install PostgreSQL, run:"
  echo "    export P4U_PG_PASSWORD='your_strong_password'"
  echo "    sudo bash ${SCRIPT_DIR}/step1-install-postgres.sh"
fi

echo ""
echo "========== Step 1 complete =========="
echo "Next: Step 2 — convert schema and update services for PostgreSQL."
