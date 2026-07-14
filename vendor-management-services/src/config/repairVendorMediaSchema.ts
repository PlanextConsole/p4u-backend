import { createConnection, RowDataPacket } from 'mysql2/promise';
import { isPostgresDbType } from './database';

const PgClient = require('pg').Client;

/** Vendor-scoped media library tables (folders + assets). */
export async function repairVendorMediaSchema(): Promise<void> {
  if (isPostgresDbType()) {
    await repairPostgres();
    return;
  }
  await repairMysql();
}

async function repairMysql(): Promise<void> {
  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USERNAME || 'root';
  const password = process.env.DB_PASSWORD || 'root@123';
  const database = process.env.DB_NAME || 'p4u_admin_db';

  let connection: Awaited<ReturnType<typeof createConnection>> | undefined;
  try {
    connection = await createConnection({ host, port, user, password, database });

    const [folders] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, 'vendor_media_folders'],
    );
    if (!folders.length) {
      await connection.query(`
        CREATE TABLE vendor_media_folders (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          vendor_id VARCHAR(36) NOT NULL,
          name VARCHAR(160) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          INDEX idx_vendor_media_folders_vendor (vendor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('[vendor-service] Created vendor_media_folders');
    }

    const [assets] = await connection.query<RowDataPacket[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [database, 'vendor_media_assets'],
    );
    if (!assets.length) {
      await connection.query(`
        CREATE TABLE vendor_media_assets (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          vendor_id VARCHAR(36) NOT NULL,
          folder_id VARCHAR(36) NULL,
          original_name VARCHAR(255) NOT NULL,
          mime_type VARCHAR(128) NOT NULL,
          size_bytes BIGINT NOT NULL DEFAULT 0,
          url VARCHAR(512) NOT NULL,
          created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          INDEX idx_vendor_media_assets_vendor (vendor_id),
          INDEX idx_vendor_media_assets_folder (folder_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      console.log('[vendor-service] Created vendor_media_assets');
    }
  } catch (err) {
    console.warn('[vendor-service] vendor media schema repair skipped:', err instanceof Error ? err.message : err);
  } finally {
    if (connection) await connection.end().catch(() => undefined);
  }
}

async function repairPostgres(): Promise<void> {
  const client = new PgClient({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'p4u_admin_db',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_media_folders (
        id varchar(36) PRIMARY KEY,
        vendor_id varchar(36) NOT NULL,
        name varchar(160) NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vendor_media_folders_vendor ON vendor_media_folders (vendor_id)`,
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS vendor_media_assets (
        id varchar(36) PRIMARY KEY,
        vendor_id varchar(36) NOT NULL,
        folder_id varchar(36),
        original_name varchar(255) NOT NULL,
        mime_type varchar(128) NOT NULL,
        size_bytes bigint NOT NULL DEFAULT 0,
        url varchar(512) NOT NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vendor_media_assets_vendor ON vendor_media_assets (vendor_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_vendor_media_assets_folder ON vendor_media_assets (folder_id)`,
    );
    console.log('[vendor-service] Ensured vendor media tables (postgres)');
  } catch (err) {
    console.warn(
      '[vendor-service] postgres vendor media schema repair skipped:',
      err instanceof Error ? err.message : err,
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
