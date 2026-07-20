-- Repair UUID defaults required by TypeORM @PrimaryGeneratedColumn('uuid').
-- Run as the PostgreSQL table owner (normally the postgres OS user).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS social_post_likes
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS social_post_comments
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS social_post_saves
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS social_user_follows
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS social_media
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS social_conversations
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS social_messages
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Socio rewards are written in the same transaction as Like/Share. Missing
-- defaults here otherwise roll back a successful interaction.
ALTER TABLE IF EXISTS customer_reward_points_ledger
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE IF EXISTS commerce_settlements
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

-- Reconcile visible counters with their source rows in case an older failed
-- deployment left counters out of sync.
UPDATE social_posts AS post
SET like_count = (
      SELECT COUNT(*)::int
      FROM social_post_likes AS interaction
      WHERE interaction.post_id = post.id
    ),
    comment_count = (
      SELECT COUNT(*)::int
      FROM social_post_comments AS interaction
      WHERE interaction.post_id = post.id
        AND interaction.status = 'published'
    );
