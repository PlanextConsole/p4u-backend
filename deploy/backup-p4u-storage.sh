#!/usr/bin/env bash
# Daily backup of P4U upload storage. Retains last 14 days.
set -euo pipefail

P4U_ROOT="${P4U_ROOT:-/opt/p4u}"
STORAGE="${P4U_ROOT}/storage"
BACKUP_DIR="${P4U_ROOT}/backups"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
STAMP="$(date +%Y-%m-%d_%H%M%S)"
ARCHIVE="${BACKUP_DIR}/p4u-storage-${STAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

if [ ! -d "$STORAGE" ]; then
  echo "Storage directory missing: $STORAGE"
  exit 1
fi

tar -czf "$ARCHIVE" -C "$P4U_ROOT" storage
echo "Created $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

find "$BACKUP_DIR" -maxdepth 1 -name 'p4u-storage-*.tar.gz' -mtime +"$RETAIN_DAYS" -delete
echo "Pruned backups older than ${RETAIN_DAYS} days"
