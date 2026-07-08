#!/usr/bin/env bash
# Step 1c — Install PostgreSQL and create staging database (run on P4U server as root/sudo).
# Does NOT remove MySQL. Both can run side-by-side during migration.
#
# Usage:
#   export P4U_PG_USER=p4u_app
#   export P4U_PG_PASSWORD='choose_a_strong_password'
#   export P4U_PG_DATABASE=p4u_admin_db_staging
#   sudo bash scripts/migration/postgres/step1-install-postgres.sh

set -euo pipefail

P4U_PG_USER="${P4U_PG_USER:-p4u_app}"
P4U_PG_PASSWORD="${P4U_PG_PASSWORD:-}"
P4U_PG_DATABASE="${P4U_PG_DATABASE:-p4u_admin_db_staging}"

if [[ -z "$P4U_PG_PASSWORD" ]]; then
  echo "ERROR: Set P4U_PG_PASSWORD before running (e.g. export P4U_PG_PASSWORD='...')"
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "ERROR: Run with sudo."
  exit 1
fi

echo "==> Installing PostgreSQL (Ubuntu/Debian)..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y postgresql postgresql-contrib

systemctl enable postgresql
systemctl start postgresql

echo "==> Creating role and database..."
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${P4U_PG_USER}') THEN
    CREATE ROLE ${P4U_PG_USER} LOGIN PASSWORD '${P4U_PG_PASSWORD}';
  ELSE
    ALTER ROLE ${P4U_PG_USER} WITH PASSWORD '${P4U_PG_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${P4U_PG_DATABASE} OWNER ${P4U_PG_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${P4U_PG_DATABASE}')\gexec

GRANT ALL PRIVILEGES ON DATABASE ${P4U_PG_DATABASE} TO ${P4U_PG_USER};
SQL

echo "==> PostgreSQL ready."
echo "    Host:     localhost"
echo "    Port:     5432"
echo "    Database: ${P4U_PG_DATABASE}"
echo "    User:     ${P4U_PG_USER}"
echo ""
echo "Test connection:"
echo "  PGPASSWORD='***' psql -h localhost -U ${P4U_PG_USER} -d ${P4U_PG_DATABASE} -c 'SELECT version();'"
