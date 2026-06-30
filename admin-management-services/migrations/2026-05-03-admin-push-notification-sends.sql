CREATE TABLE IF NOT EXISTS admin_push_notification_sends (
  id char(36) NOT NULL,
  target_audience varchar(64) NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  deep_link varchar(512) NULL,
  target_user_ids json NULL,
  status varchar(24) NOT NULL DEFAULT 'sent',
  provider_detail text NULL,
  actor_sub varchar(255) NULL,
  created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY idx_push_sends_created (created_at),
  KEY idx_push_sends_audience (target_audience)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
