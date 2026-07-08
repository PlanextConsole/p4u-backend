-- Phase 11: payment-management-services

CREATE TABLE IF NOT EXISTS user_payment_intents (
  id varchar(36) PRIMARY KEY,
  order_id varchar(36) NOT NULL,
  customer_id varchar(36),
  currency varchar(16) NOT NULL DEFAULT 'INR',
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'created',
  provider_ref varchar(128),
  provider_payment_id varchar(128),
  provider_signature varchar(256),
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_payment_intents_order ON user_payment_intents (order_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_intents_customer ON user_payment_intents (customer_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_intents_status ON user_payment_intents (status);
