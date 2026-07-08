#!/usr/bin/env bash
# Step 1a — Full MySQL backup before Postgres migration (run on the P4U server).
# Usage:
#   export MYSQL_USER=root
#   export MYSQL_PASSWORD='your_password'   # optional; mysqldump will prompt if unset
#   export MYSQL_DATABASE=p4u_admin_db
#   bash scripts/migration/postgres/step1-backup-mysql.sh

set -euo pipefail

BACKUP_ROOT="${P4U_BACKUP_ROOT:-/opt/p4u/backups/mysql}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-root}"
MYSQL_DATABASE="${MYSQL_DATABASE:-p4u_admin_db}"
KEYCLOAK_DATABASE="${KEYCLOAK_DATABASE:-keycloak}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_ROOT"

echo "==> Backing up MySQL database: ${MYSQL_DATABASE}"
DUMP_FILE="${BACKUP_ROOT}/${MYSQL_DATABASE}_${STAMP}.sql"

MYSQL_PWD_ARGS=()
if [[ -n "${MYSQL_PASSWORD:-}" ]]; then
  MYSQL_PWD_ARGS=(--password="${MYSQL_PASSWORD}")
fi

mysqldump \
  -h "$MYSQL_HOST" \
 -P "$MYSQL_PORT" \
  -u "$MYSQL_USER" \
  "${MYSQL_PWD_ARGS[@]}" \
  --single-transaction \
  --routines \
  --triggers \
  --events \
  --databases "$MYSQL_DATABASE" \
  > "$DUMP_FILE"

gzip -f "$DUMP_FILE"
echo "    Saved: ${DUMP_FILE}.gz"

if mysql -h "$MYSQL_HOST" -P "$MYSQL_PORT" -u "$MYSQL_USER" "${MYSQL_PWD_ARGS[@]}" \
  -e "USE ${KEYCLOAK_DATABASE}" 2>/dev/null; then
  echo "==> Backing up Keycloak database: ${KEYCLOAK_DATABASE}"
  KC_FILE="${BACKUP_ROOT}/${KEYCLOAK_DATABASE}_${STAMP}.sql"
  mysqldump \
    -h "$MYSQL_HOST" \
   -P "$MYSQL_PORT" \
    -u "$MYSQL_USER" \
    "${MYSQL_PWD_ARGS[@]}" \
    --single-transaction \
    --databases "$KEYCLOAK_DATABASE" \
    > "$KC_FILE"
  gzip -f "$KC_FILE"
  echo "    Saved: ${KC_FILE}.gz"
else
  echo "==> Keycloak database '${KEYCLOAK_DATABASE}' not found — skipped."
fi

echo "==> Backup complete. Files in ${BACKUP_ROOT}:"
ls -lh "$BACKUP_ROOT" | tail -n 10
