-- Vendor ↔ catalog service offers (per-vendor price for Services tab / bookings).
-- Required when TypeORM `synchronize` is false.

CREATE TABLE IF NOT EXISTS catalog_vendor_services (
  id CHAR(36) NOT NULL,
  vendor_id VARCHAR(36) NOT NULL,
  service_id VARCHAR(36) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  metadata JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY UQ_catalog_vendor_services_vendor_service (vendor_id, service_id),
  KEY IDX_catalog_vendor_services_vendor_id (vendor_id),
  KEY IDX_catalog_vendor_services_service_id (service_id),
  KEY IDX_catalog_vendor_services_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
