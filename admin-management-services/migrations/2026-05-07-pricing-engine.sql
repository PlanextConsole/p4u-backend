-- Pricing-engine schema additions: vendor tier link, override columns. Idempotent via info_schema checks.

DELIMITER $$

DROP PROCEDURE IF EXISTS p4u_add_col_if_missing $$
CREATE PROCEDURE p4u_add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl VARCHAR(255))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @stmt = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN ', ddl);
    PREPARE stmt FROM @stmt;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END$$

DELIMITER ;

-- catalog_vendors
CALL p4u_add_col_if_missing('catalog_vendors', 'vendor_plan_id', '`vendor_plan_id` VARCHAR(36) NULL');
CALL p4u_add_col_if_missing('catalog_vendors', 'enrollment_cost', '`enrollment_cost` DECIMAL(12,2) NULL');
CALL p4u_add_col_if_missing('catalog_vendors', 'coverage_radius_km', '`coverage_radius_km` DECIMAL(8,2) NULL');
CALL p4u_add_col_if_missing('catalog_vendors', 'restriction', '`restriction` VARCHAR(32) NULL');
CALL p4u_add_col_if_missing('catalog_vendors', 'self_delivery', '`self_delivery` TINYINT(1) NOT NULL DEFAULT 0');
CALL p4u_add_col_if_missing('catalog_vendors', 'max_redemption_percent', '`max_redemption_percent` DECIMAL(5,2) NULL');

-- product_categories (admin product taxonomy)
CALL p4u_add_col_if_missing('product_categories', 'commission_override_percent', '`commission_override_percent` DECIMAL(5,2) NULL');

-- catalog_products
CALL p4u_add_col_if_missing('catalog_products', 'commission_override_percent', '`commission_override_percent` DECIMAL(5,2) NULL');

-- catalog_categories (mirror used by catalog-management-services if products reference it)
CALL p4u_add_col_if_missing('catalog_categories', 'commission_override_percent', '`commission_override_percent` DECIMAL(5,2) NULL');

DROP PROCEDURE IF EXISTS p4u_add_col_if_missing;
