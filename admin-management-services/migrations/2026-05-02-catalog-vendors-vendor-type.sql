-- Adds vendor_type (PRODUCT | SERVICE) mirror of vendor_kind for APIs and consistent filtering.
-- Safe to run multiple times: checks information_schema before ALTER.

SET @db = DATABASE();

SET @sql := (
  SELECT IF(
    EXISTS(
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_vendors' AND COLUMN_NAME = 'vendor_type'
    ),
    'SELECT ''vendor_type already exists'' AS msg',
    'ALTER TABLE catalog_vendors ADD COLUMN vendor_type VARCHAR(16) NOT NULL DEFAULT ''PRODUCT'''
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE catalog_vendors
SET vendor_type = IF(LOWER(TRIM(vendor_kind)) = 'service', 'SERVICE', 'PRODUCT');
