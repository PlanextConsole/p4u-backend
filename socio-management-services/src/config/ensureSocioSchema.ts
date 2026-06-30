import { AppDataSource } from './database';

/** Idempotent DDL for tables added after initial socio deploy. */
export async function ensureSocioSchema(): Promise<void> {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS social_post_saves (
      id CHAR(36) NOT NULL PRIMARY KEY,
      post_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(128) NOT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_social_post_saves_post_user (post_id, user_id),
      KEY idx_social_post_saves_user (user_id),
      KEY idx_social_post_saves_post (post_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS social_conversations (
      id CHAR(36) NOT NULL PRIMARY KEY,
      participant_one_id VARCHAR(128) NOT NULL,
      participant_two_id VARCHAR(128) NOT NULL,
      last_message_text TEXT NULL,
      last_message_at DATETIME(6) NULL,
      is_request TINYINT(1) NOT NULL DEFAULT 0,
      request_for_user_id VARCHAR(128) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_social_conv_pair (participant_one_id, participant_two_id),
      KEY idx_social_conv_one (participant_one_id),
      KEY idx_social_conv_two (participant_two_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS social_messages (
      id CHAR(36) NOT NULL PRIMARY KEY,
      conversation_id CHAR(36) NOT NULL,
      sender_id VARCHAR(128) NOT NULL,
      content_text TEXT NULL,
      media_url TEXT NULL,
      media_type VARCHAR(16) NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      KEY idx_social_msg_conv (conversation_id),
      KEY idx_social_msg_sender (sender_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS social_conversation_state (
      conversation_id CHAR(36) NOT NULL,
      user_id VARCHAR(128) NOT NULL,
      unread_count INT NOT NULL DEFAULT 0,
      last_read_at DATETIME(6) NULL,
      PRIMARY KEY (conversation_id, user_id),
      KEY idx_social_conv_state_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}
