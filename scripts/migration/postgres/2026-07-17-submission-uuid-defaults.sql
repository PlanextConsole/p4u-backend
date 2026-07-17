-- Repair existing PostgreSQL installations whose UUID varchar primary keys
-- were created without defaults. TypeORM's @PrimaryGeneratedColumn('uuid')
-- emits DEFAULT on PostgreSQL, so these defaults prevent not-null failures.

ALTER TABLE IF EXISTS vendor_signup_requests
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE IF EXISTS social_posts
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE IF EXISTS social_stories
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
