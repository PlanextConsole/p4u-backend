-- Media Library: folders + file index (local disk under /uploads/media-library/... or b2 after migrate)
CREATE TABLE IF NOT EXISTS media_library_folders (
  id char(36) NOT NULL,
  name varchar(160) NOT NULL,
  slug varchar(180) NOT NULL,
  kind varchar(24) NOT NULL DEFAULT 'general',
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_library_folders_slug (slug),
  KEY idx_media_library_folders_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS media_library_assets (
  id char(36) NOT NULL,
  folder_id char(36) NOT NULL,
  original_name varchar(512) NOT NULL,
  file_url text NOT NULL,
  relative_path varchar(512) NOT NULL,
  mime varchar(160) NOT NULL,
  size_bytes bigint unsigned NOT NULL,
  storage_kind varchar(16) NOT NULL DEFAULT 'local',
  b2_key varchar(1024) NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_media_library_assets_folder (folder_id),
  KEY idx_media_library_assets_storage (storage_kind),
  CONSTRAINT fk_media_library_assets_folder FOREIGN KEY (folder_id) REFERENCES media_library_folders (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
