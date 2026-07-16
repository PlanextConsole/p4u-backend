-- Reward credits expire 60 days after earning. Debits never expire.
ALTER TABLE customer_reward_points_ledger
  ADD COLUMN IF NOT EXISTS expires_at DATETIME NULL;

UPDATE customer_reward_points_ledger
SET expires_at = DATE_ADD(created_at, INTERVAL 60 DAY)
WHERE points > 0 AND expires_at IS NULL;

CREATE INDEX idx_reward_points_expires_at
  ON customer_reward_points_ledger (expires_at);
