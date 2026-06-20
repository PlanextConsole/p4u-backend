-- Service vendors: JSON schedule for customer-facing booking slots (commerce-management-services reads this).

DELIMITER $$

DROP PROCEDURE IF EXISTS p4u_add_col_if_missing $$
CREATE PROCEDURE p4u_add_col_if_missing(IN tbl VARCHAR(64), IN col VARCHAR(64), IN ddl VARCHAR(512))
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

CALL p4u_add_col_if_missing('catalog_vendors', 'booking_availability_json', '`booking_availability_json` JSON NULL');

DROP PROCEDURE IF EXISTS p4u_add_col_if_missing;
