CREATE TABLE IF NOT EXISTS admin_bulk_upload_jobs (
  id char(36) NOT NULL,
  upload_type varchar(24) NOT NULL,
  original_filename varchar(512) NOT NULL,
  stored_relative_path varchar(512) NOT NULL,
  status varchar(24) NOT NULL,
  total_rows int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  error_count int NOT NULL DEFAULT 0,
  result_detail json NULL,
  actor_sub varchar(255) NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_bulk_upload_type (upload_type),
  KEY idx_bulk_upload_status (status),
  KEY idx_bulk_upload_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
