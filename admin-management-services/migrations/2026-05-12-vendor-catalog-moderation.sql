-- Vendor catalog moderation: products and per-vendor service listings require admin approval.
-- Idempotent via stored procedure (same pattern as pricing-engine migration).

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

CALL p4u_add_col_if_missing('catalog_products', 'moderation_status', '`moderation_status` VARCHAR(32) NOT NULL DEFAULT ''approved''');
CALL p4u_add_col_if_missing('catalog_vendor_services', 'moderation_status', '`moderation_status` VARCHAR(32) NOT NULL DEFAULT ''approved''');

DROP PROCEDURE IF EXISTS p4u_add_col_if_missing;
