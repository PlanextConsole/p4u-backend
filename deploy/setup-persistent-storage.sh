#!/usr/bin/env bash
# P4U production — persistent upload storage outside git clones.
# Run on VPS as root: bash /opt/p4u/backend/deploy/setup-persistent-storage.sh
set -euo pipefail

P4U_ROOT="${P4U_ROOT:-/opt/p4u}"
BACKEND="${P4U_ROOT}/backend"
STORAGE_ADMIN="${P4U_ROOT}/storage/admin-uploads"
STORAGE_VENDOR="${P4U_ROOT}/storage/vendor-uploads"
STORAGE_SOCIO="${P4U_ROOT}/storage/socio-uploads"
BACKUP_DIR="${P4U_ROOT}/backups"
ADMIN_UPLOADS="${BACKEND}/admin-management-services/uploads"
VENDOR_UPLOADS="${BACKEND}/vendor-management-services/uploads"
SOCIO_UPLOADS="${BACKEND}/socio-management-services/uploads"

echo "=== P4U persistent storage setup ==="

mkdir -p "$STORAGE_ADMIN" "$STORAGE_VENDOR" "$STORAGE_SOCIO" "$BACKUP_DIR"
chown -R "${SUDO_USER:-root}:${SUDO_USER:-root}" "${P4U_ROOT}/storage" "${P4U_ROOT}/backups" 2>/dev/null || true

link_upload_dir() {
  local target="$1"
  local storage="$2"
  local label="$3"

  if [ -L "$target" ]; then
    echo "[$label] symlink already exists: $target -> $(readlink -f "$target")"
    return
  fi

  if [ -d "$target" ] && [ ! -L "$target" ]; then
    if [ "$(ls -A "$target" 2>/dev/null | wc -l)" -gt 0 ]; then
      echo "[$label] migrating existing files from $target to $storage"
      cp -a "$target/." "$storage/"
    fi
    rm -rf "$target"
  fi

  ln -sfn "$storage" "$target"
  echo "[$label] linked $target -> $storage"
}

link_upload_dir "$ADMIN_UPLOADS" "$STORAGE_ADMIN" "admin"
link_upload_dir "$VENDOR_UPLOADS" "$STORAGE_VENDOR" "vendor"
link_upload_dir "$SOCIO_UPLOADS" "$STORAGE_SOCIO" "socio"

BACKUP_SCRIPT="${BACKEND}/deploy/backup-p4u-storage.sh"
if [ -f "$BACKUP_SCRIPT" ]; then
  chmod +x "$BACKUP_SCRIPT"
  CRON_LINE="0 3 * * * ${BACKUP_SCRIPT} >> ${BACKUP_DIR}/backup.log 2>&1"
  if crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
    echo "[backup] cron entry already present"
  else
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "[backup] installed daily cron at 03:00"
  fi
fi

echo ""
echo "Done. Add to service .env (optional — symlinks alone are enough):"
echo "  admin-management-services/.env:  UPLOAD_DIR=${STORAGE_ADMIN}"
echo "  vendor-management-services/.env: UPLOAD_DIR=${STORAGE_VENDOR}"
echo "  socio-management-services/.env:  UPLOAD_DIR=${STORAGE_SOCIO}"
echo ""
echo "Then: pm2 restart admin vendor socio gateway && pm2 save"
