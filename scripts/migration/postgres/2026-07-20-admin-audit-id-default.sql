-- Repair PostgreSQL deployments created before admin audit UUID defaults were added.
-- Safe to run repeatedly.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS admin_audit_logs
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
