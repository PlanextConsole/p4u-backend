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
}
