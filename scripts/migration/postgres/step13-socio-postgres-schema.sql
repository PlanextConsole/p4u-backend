-- Phase 13: socio-management-services
-- Shared tables (customer_profiles, commerce_settlements, etc.) already exist from earlier phases.

CREATE TABLE IF NOT EXISTS social_posts (
  id varchar(36) PRIMARY KEY,
  author_id varchar(128) NOT NULL,
  author_type varchar(16) NOT NULL DEFAULT 'customer',
  content_text text,
  media_urls jsonb,
  post_type varchar(32) NOT NULL DEFAULT 'text',
  visibility varchar(16) NOT NULL DEFAULT 'public',
  like_count int NOT NULL DEFAULT 0,
  comment_count int NOT NULL DEFAULT 0,
  share_count int NOT NULL DEFAULT 0,
  status varchar(32) NOT NULL DEFAULT 'published',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_social_posts_author ON social_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts (status);

CREATE TABLE IF NOT EXISTS social_post_likes (
  id varchar(36) PRIMARY KEY,
  post_id varchar(36) NOT NULL,
  user_id varchar(128) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_post_likes_post ON social_post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_likes_user ON social_post_likes (user_id);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id varchar(36) PRIMARY KEY,
  post_id varchar(36) NOT NULL,
  user_id varchar(128) NOT NULL,
  parent_comment_id varchar(36),
  content_text text NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'published',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_post ON social_post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_user ON social_post_comments (user_id);

CREATE TABLE IF NOT EXISTS social_post_saves (
  id varchar(36) PRIMARY KEY,
  post_id varchar(36) NOT NULL,
  user_id varchar(128) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_post_saves_user ON social_post_saves (user_id);
CREATE INDEX IF NOT EXISTS idx_social_post_saves_post ON social_post_saves (post_id);

CREATE TABLE IF NOT EXISTS social_user_follows (
  id varchar(36) PRIMARY KEY,
  follower_id varchar(128) NOT NULL,
  following_id varchar(128) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_social_user_follows_follower ON social_user_follows (follower_id);
CREATE INDEX IF NOT EXISTS idx_social_user_follows_following ON social_user_follows (following_id);

CREATE TABLE IF NOT EXISTS social_stories (
  id varchar(36) PRIMARY KEY,
  author_id varchar(128) NOT NULL,
  media_url varchar(512) NOT NULL,
  media_type varchar(16) NOT NULL DEFAULT 'image',
  thumbnail_url varchar(512),
  text_overlay varchar(255),
  view_count int NOT NULL DEFAULT 0,
  expires_at timestamp NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  metadata jsonb,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_social_stories_author ON social_stories (author_id);
CREATE INDEX IF NOT EXISTS idx_social_stories_status ON social_stories (status);

CREATE TABLE IF NOT EXISTS social_media (
  id varchar(36) PRIMARY KEY,
  kind varchar(16) NOT NULL DEFAULT 'image',
  mime_type varchar(128) NOT NULL,
  original_name varchar(512),
  size_bytes int NOT NULL DEFAULT 0,
  storage_path varchar(512),
  data bytea,
  owner_id varchar(128) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_social_media_owner ON social_media (owner_id);
CREATE INDEX IF NOT EXISTS idx_social_media_kind ON social_media (kind);

CREATE TABLE IF NOT EXISTS social_conversations (
  id varchar(36) PRIMARY KEY,
  participant_one_id varchar(128) NOT NULL,
  participant_two_id varchar(128) NOT NULL,
  last_message_text text,
  last_message_at timestamp,
  is_request boolean NOT NULL DEFAULT false,
  request_for_user_id varchar(128),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (participant_one_id, participant_two_id)
);
CREATE INDEX IF NOT EXISTS idx_social_conv_one ON social_conversations (participant_one_id);
CREATE INDEX IF NOT EXISTS idx_social_conv_two ON social_conversations (participant_two_id);

CREATE TABLE IF NOT EXISTS social_messages (
  id varchar(36) PRIMARY KEY,
  conversation_id varchar(36) NOT NULL,
  sender_id varchar(128) NOT NULL,
  content_text text,
  media_url text,
  media_type varchar(16),
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_social_msg_conv ON social_messages (conversation_id);
CREATE INDEX IF NOT EXISTS idx_social_msg_sender ON social_messages (sender_id);

CREATE TABLE IF NOT EXISTS social_conversation_state (
  conversation_id varchar(36) NOT NULL,
  user_id varchar(128) NOT NULL,
  unread_count int NOT NULL DEFAULT 0,
  last_read_at timestamp,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_social_conv_state_user ON social_conversation_state (user_id);

GRANT ALL PRIVILEGES ON TABLE social_posts TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_post_likes TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_post_comments TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_post_saves TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_user_follows TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_stories TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_media TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_conversations TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_messages TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE social_conversation_state TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE customer_profiles TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE customer_reward_points_ledger TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE commerce_settlements TO p4u_app;
GRANT ALL PRIVILEGES ON TABLE admin_platform_variables TO p4u_app;
