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

  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS social_calls (
    id CHAR(36) NOT NULL PRIMARY KEY, conversation_id CHAR(36) NOT NULL,
    caller_id VARCHAR(128) NOT NULL, callee_id VARCHAR(128) NOT NULL,
    call_type VARCHAR(12) NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'ringing',
    idempotency_key VARCHAR(80) NOT NULL, offer_sdp LONGTEXT NULL, answer_sdp LONGTEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), accepted_at DATETIME(6) NULL,
    ended_at DATETIME(6) NULL, expires_at DATETIME(6) NOT NULL,
    UNIQUE KEY uq_social_call_idempotency (caller_id,idempotency_key),
    KEY idx_social_call_callee (callee_id,status,created_at), KEY idx_social_call_conversation (conversation_id,created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS social_call_signals (
    sequence_no BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, id CHAR(36) NOT NULL UNIQUE,
    call_id CHAR(36) NOT NULL, sender_id VARCHAR(128) NOT NULL, signal_type VARCHAR(20) NOT NULL,
    payload_json JSON NOT NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    KEY idx_social_call_signal (call_id,sequence_no),
    CONSTRAINT fk_social_call_signal FOREIGN KEY(call_id) REFERENCES social_calls(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  await AppDataSource.query(`CREATE TABLE IF NOT EXISTS social_content_reports (
    id CHAR(36) NOT NULL PRIMARY KEY, reporter_id VARCHAR(128) NOT NULL,
    target_type VARCHAR(16) NOT NULL, target_id VARCHAR(36) NOT NULL,
    reason VARCHAR(32) NOT NULL, details VARCHAR(500) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending', moderator_id VARCHAR(128) NULL,
    moderator_note VARCHAR(500) NULL, moderation_action VARCHAR(24) NULL,
    resolved_at DATETIME(6) NULL, created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_social_report_reporter_target (reporter_id,target_type,target_id),
    KEY idx_social_reports_status (status,created_at), KEY idx_social_reports_target (target_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
}

/** Postgres-safe DDL for moderation reports (MySQL ensureSocioSchema is skipped on postgres). */
export async function ensureSocioPostgresSchema(): Promise<void> {
  await AppDataSource.query(`
    CREATE TABLE IF NOT EXISTS social_content_reports (
      id VARCHAR(36) PRIMARY KEY,
      reporter_id VARCHAR(128) NOT NULL,
      target_type VARCHAR(16) NOT NULL,
      target_id VARCHAR(36) NOT NULL,
      reason VARCHAR(32) NOT NULL,
      details VARCHAR(500) NULL,
      status VARCHAR(24) NOT NULL DEFAULT 'pending',
      moderator_id VARCHAR(128) NULL,
      moderator_note VARCHAR(500) NULL,
      moderation_action VARCHAR(24) NULL,
      resolved_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await AppDataSource.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_social_report_reporter_target
      ON social_content_reports (reporter_id, target_type, target_id)
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_social_reports_status
      ON social_content_reports (status, created_at)
  `);
  await AppDataSource.query(`
    CREATE INDEX IF NOT EXISTS idx_social_reports_target
      ON social_content_reports (target_id)
  `);
}
