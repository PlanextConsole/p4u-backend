-- =============================================================================
-- Split catalog taxonomy: product_categories / product_subcategories /
-- service_categories, and catalog_service_items.service_category_id
--
-- Safe to re-run: CREATE IF NOT EXISTS, conditional ALTER, legacy copies only
-- when catalog_categories exists.
--
-- Usage (replace DB / credentials):
--   mysql -h HOST -P PORT -u USER -p DB_NAME < scripts/migrate-split-catalog-tables.sql
-- =============================================================================

SET NAMES utf8mb4;
SET @db := DATABASE();

-- -----------------------------------------------------------------------------
-- 1) New tables (match TypeORM: ProductCategory, ProductSubcategory, ServiceCategory)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `product_categories` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(128) DEFAULT NULL,
  `availability` tinyint(1) NOT NULL DEFAULT 0,
  `emergency` tinyint(1) NOT NULL DEFAULT 0,
  `trending` tinyint(1) NOT NULL DEFAULT 0,
  `description` text,
  `thumbnail_url` varchar(512) DEFAULT NULL,
  `banner_urls` json DEFAULT NULL,
  `icon_url` varchar(512) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `metadata` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_product_categories_name` (`name`),
  KEY `IDX_product_categories_slug` (`slug`),
  KEY `IDX_product_categories_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `product_subcategories` (
  `id` varchar(36) NOT NULL,
  `product_category_id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(128) DEFAULT NULL,
  `availability` tinyint(1) NOT NULL DEFAULT 0,
  `emergency` tinyint(1) NOT NULL DEFAULT 0,
  `trending` tinyint(1) NOT NULL DEFAULT 0,
  `description` text,
  `thumbnail_url` varchar(512) DEFAULT NULL,
  `banner_urls` json DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `metadata` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_product_subcategories_product_category_id` (`product_category_id`),
  KEY `IDX_product_subcategories_name` (`name`),
  KEY `IDX_product_subcategories_slug` (`slug`),
  KEY `IDX_product_subcategories_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `service_categories` (
  `id` varchar(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `slug` varchar(128) DEFAULT NULL,
  `availability` tinyint(1) NOT NULL DEFAULT 0,
  `emergency` tinyint(1) NOT NULL DEFAULT 0,
  `trending` tinyint(1) NOT NULL DEFAULT 0,
  `description` text,
  `thumbnail_url` varchar(512) DEFAULT NULL,
  `banner_urls` json DEFAULT NULL,
  `icon_url` varchar(512) DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `metadata` json DEFAULT NULL,
  `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_service_categories_name` (`name`),
  KEY `IDX_service_categories_slug` (`slug`),
  KEY `IDX_service_categories_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2) catalog_service_items: legacy category_id -> service_category_id (idempotent)
-- -----------------------------------------------------------------------------

SET @tbl := (
  SELECT COUNT(*) FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_service_items'
);
SET @has_old := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_service_items' AND COLUMN_NAME = 'category_id'
);
SET @has_new := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'catalog_service_items' AND COLUMN_NAME = 'service_category_id'
);

SET @sql := IF(
  @tbl > 0 AND @has_old > 0,
  'ALTER TABLE `catalog_service_items` CHANGE COLUMN `category_id` `service_category_id` varchar(36) DEFAULT NULL',
  IF(
    @tbl > 0 AND @has_old = 0 AND @has_new = 0,
    'ALTER TABLE `catalog_service_items` ADD COLUMN `service_category_id` varchar(36) DEFAULT NULL AFTER `id`',
    'SELECT ''catalog_service_items: no category_id rename or add needed'' AS migrate_split_catalog_msg'
  )
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 3) Legacy: copy unified catalog_categories into split tables (only if it exists)
--     Root rows -> both product_categories and service_categories (same ids).
--     Child rows -> product_subcategories. Idempotent via ON DUPLICATE KEY UPDATE.
-- -----------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS `p4u_migrate_split_catalog_legacy`;

DELIMITER $$

CREATE PROCEDURE `p4u_migrate_split_catalog_legacy`()
BEGIN
  DECLARE legacy_exists INT DEFAULT 0;

  SELECT COUNT(*) INTO legacy_exists
  FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'catalog_categories';

  IF legacy_exists = 0 THEN
    SELECT 'catalog_categories not present - skipping legacy row copy' AS migrate_split_catalog_msg;
  ELSE
    INSERT INTO `product_categories` (
      `id`, `name`, `slug`, `availability`, `emergency`, `trending`, `description`,
      `thumbnail_url`, `banner_urls`, `icon_url`, `sort_order`, `is_active`, `metadata`, `created_at`, `updated_at`
    )
    SELECT
      `id`, `name`, `slug`, `availability`, `emergency`, `trending`, `description`,
      `thumbnail_url`, `banner_urls`, `icon_url`, `sort_order`, `is_active`, `metadata`, `created_at`, `updated_at`
    FROM `catalog_categories`
    WHERE `parent_id` IS NULL
    ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);

    INSERT INTO `service_categories` (
      `id`, `name`, `slug`, `availability`, `emergency`, `trending`, `description`,
      `thumbnail_url`, `banner_urls`, `icon_url`, `sort_order`, `is_active`, `metadata`, `created_at`, `updated_at`
    )
    SELECT
      `id`, `name`, `slug`, `availability`, `emergency`, `trending`, `description`,
      `thumbnail_url`, `banner_urls`, `icon_url`, `sort_order`, `is_active`, `metadata`, `created_at`, `updated_at`
    FROM `catalog_categories`
    WHERE `parent_id` IS NULL
    ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);

    INSERT INTO `product_subcategories` (
      `id`, `product_category_id`, `name`, `slug`, `availability`, `emergency`, `trending`, `description`,
      `thumbnail_url`, `banner_urls`, `sort_order`, `is_active`, `metadata`, `created_at`, `updated_at`
    )
    SELECT
      `id`, `parent_id`, `name`, `slug`, `availability`, `emergency`, `trending`, `description`,
      `thumbnail_url`, `banner_urls`, `sort_order`, `is_active`, `metadata`, `created_at`, `updated_at`
    FROM `catalog_categories`
    WHERE `parent_id` IS NOT NULL
    ON DUPLICATE KEY UPDATE `updated_at` = VALUES(`updated_at`);
  END IF;
END$$

DELIMITER ;

CALL `p4u_migrate_split_catalog_legacy`();
DROP PROCEDURE IF EXISTS `p4u_migrate_split_catalog_legacy`;

-- -----------------------------------------------------------------------------
-- 4) Optional — drop legacy table after you have verified the app (manual only)
-- -----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS `catalog_categories`;
