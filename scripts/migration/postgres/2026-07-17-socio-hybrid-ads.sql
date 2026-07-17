-- Hybrid Socio ad configuration and safe UUID generation for admin ad rows.
ALTER TABLE content_ad_feed_items
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

INSERT INTO admin_platform_variables (id, key, value, category, is_active, created_at, updated_at)
VALUES
  (gen_random_uuid()::text, 'ADVERTISEMENT_PER_POSTS', jsonb_build_object('amount', 5, 'valueType', 'FLAT', 'currencyType', 'None'), 'Socio', true, NOW(), NOW()),
  (gen_random_uuid()::text, 'SOCIO_AD_MODE', jsonb_build_object('value', 'prefer_admin_then_admob'), 'Socio', true, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;
