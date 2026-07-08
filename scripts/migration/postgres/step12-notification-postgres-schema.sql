-- Phase 12: notification-management-services
-- user_notifications already created in step8-vendor-postgres-schema.sql

CREATE TABLE IF NOT EXISTS user_devices (
  id varchar(36) PRIMARY KEY,
  user_id varchar(128) NOT NULL,
  device_token varchar(512) NOT NULL,
  platform varchar(32) NOT NULL DEFAULT 'web',
  status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices (user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_token ON user_devices (device_token);

GRANT ALL PRIVILEGES ON TABLE user_notifications TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE user_devices TO p4u_app;
