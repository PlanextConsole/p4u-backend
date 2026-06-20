-- Optional listing / reference price for catalog services (`base_price`).
-- Per-vendor booking amounts remain in `catalog_vendor_services.price`.

SET @db := DATABASE();

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_service_items' AND COLUMN_NAME = 'base_price'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE catalog_service_items ADD COLUMN base_price DECIMAL(12,2) NULL DEFAULT NULL AFTER description',
  'SELECT ''base_price column already exists'' AS msg'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
