#!/usr/bin/env bash
# Step 1b — Backup service .env files, PM2 state (run on P4U server).
# Usage: bash scripts/migration/postgres/step1-backup-config.sh

set -euo pipefail

BACKEND_ROOT="${P4U_BACKEND_ROOT:-/opt/p4u/backend}"
BACKUP_ROOT="${P4U_BACKUP_ROOT:-/opt/p4u/backups}/config"
STAMP="$(date +%Y%m%d_%H%M%S)"
WORK_DIR="${BACKUP_ROOT}/work_${STAMP}"
ARCHIVE="${BACKUP_ROOT}/p4u_config_${STAMP}.tar.gz"

mkdir -p "$WORK_DIR"

echo "==> Copying .env files from ${BACKEND_ROOT}"
while IFS= read -r envfile; do
  rel="${envfile#${BACKEND_ROOT}/}"
  dest="${WORK_DIR}/env/${rel}"
  mkdir -p "$(dirname "$dest")"
  cp "$envfile" "$dest"
done < <(find "$BACKEND_ROOT" -maxdepth 2 -name '.env' -type f 2>/dev/null | sort)

if command -v pm2 >/dev/null 2>&1; then
  pm2 list > "${WORK_DIR}/pm2_list.txt" 2>&1 || true
  pm2 jlist > "${WORK_DIR}/pm2_jlist.json" 2>&1 || true
  echo "    PM2 snapshot saved"
fi

if [[ -d /etc/nginx ]]; then
  mkdir -p "${WORK_DIR}/nginx"
  cp -a /etc/nginx/sites-enabled "${WORK_DIR}/nginx/" 2>/dev/null || true
  cp -a /etc/nginx/conf.d "${WORK_DIR}/nginx/" 2>/dev/null || true
fi

tar -czf "$ARCHIVE" -C "$WORK_DIR" .
rm -rf "$WORK_DIR"

echo "==> Config archive: ${ARCHIVE}"
ls -lh "$ARCHIVE"
