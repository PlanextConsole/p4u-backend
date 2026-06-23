-- Service subcategories (mirror product_subcategories) + link on catalog_service_items
-- Safe to re-run: CREATE IF NOT EXISTS, conditional ALTER

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `service_subcategories` (
  `id` varchar(36) NOT NULL,
  `service_category_id` varchar(36) NOT NULL,
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
  KEY `IDX_service_subcategories_service_category_id` (`service_category_id`),
  KEY `IDX_service_subcategories_name` (`name`),
  KEY `IDX_service_subcategories_slug` (`slug`),
  KEY `IDX_service_subcategories_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'catalog_service_items'
    AND COLUMN_NAME = 'service_subcategory_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE `catalog_service_items` ADD COLUMN `service_subcategory_id` varchar(36) DEFAULT NULL AFTER `service_category_id`, ADD KEY `IDX_catalog_service_items_service_subcategory_id` (`service_subcategory_id`)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
