-- Adds target_user_ids for specific-user push sends (entity already expects this column).
ALTER TABLE admin_push_notification_sends
  ADD COLUMN IF NOT EXISTS target_user_ids JSON NULL AFTER deep_link;
