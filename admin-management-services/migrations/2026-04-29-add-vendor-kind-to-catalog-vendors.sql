-- Splits catalog vendors into product vs service (admin Product vs Service vendor pages).
-- Default `product` keeps existing rows on the product list until reclassified in admin.
--
-- Run this against the same database as `DB_NAME` (e.g. p4u_admin_db) if you see:
--   Unknown column 'Vendor.vendor_kind' in 'field list'
--
-- Idempotent: safe to run more than once (skips if column or index already exists).

SET @db := DATABASE();

-- Add column if missing
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_vendors' AND COLUMN_NAME = 'vendor_kind'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE catalog_vendors ADD COLUMN vendor_kind VARCHAR(16) NOT NULL DEFAULT ''product''',
  'SELECT ''vendor_kind column already exists'' AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index if missing (MySQL has no CREATE INDEX IF NOT EXISTS until 8.0; use procedure-like check)
SET @idx_exists := (
  SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_vendors' AND INDEX_NAME = 'IDX_catalog_vendors_vendor_kind'
);
SET @sql2 := IF(
  @idx_exists = 0,
  'CREATE INDEX IDX_catalog_vendors_vendor_kind ON catalog_vendors (vendor_kind)',
  'SELECT ''IDX_catalog_vendors_vendor_kind already exists'' AS msg'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;
