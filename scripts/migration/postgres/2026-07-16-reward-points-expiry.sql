ALTER TABLE customer_reward_points_ledger
  ADD COLUMN IF NOT EXISTS expires_at timestamp NULL;

UPDATE customer_reward_points_ledger
SET expires_at = created_at + INTERVAL '60 days'
WHERE points > 0 AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reward_points_expires_at
  ON customer_reward_points_ledger (expires_at);
